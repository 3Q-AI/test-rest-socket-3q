const WebSocket = require("ws");
const express = require("express");
const app = express();
const server = require("http").createServer(app);
const wss = new WebSocket.Server({ server });
const bodyParser = require('body-parser');
const path = require("path");

require("dotenv").config();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Comprobación de la variable de entorno
const googleCredentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!googleCredentialsPath) {
    console.error("Error: La variable de entorno GOOGLE_APPLICATION_CREDENTIALS no está configurada.");
    process.exit(1);
}

const fullPath = path.join(__dirname, googleCredentialsPath);
console.log(`Ruta completa del archivo de credenciales: ${fullPath}`);

// Comprobación de la existencia del archivo
const fs = require("fs");
if (!fs.existsSync(fullPath)) {
    console.error("Error: El archivo de credenciales no se encuentra en la ruta especificada.");
    process.exit(1);
}

process.env.GOOGLE_APPLICATION_CREDENTIALS = fullPath;

//Include Google Speech to Text
const speech = require("@google-cloud/speech");
const client = new speech.SpeechClient();

//Configure Transcription Request
const request = {
    config: {
        encoding: "MULAW",
        sampleRateHertz: 8000,
        languageCode: "es-CO",
    },
    interimResults: true, // If you want interim results, set this to true
};

wss.on("connection", function connection(ws) {
    console.log("New Connection Initiated");

    let recognizeStream = null;

    ws.on("message", function incoming(message) {
        const msg = JSON.parse(message);
        switch (msg.event) {
            case "connected":
                console.log(`A new call has connected.`);
                break;
            case "start":
                console.log(`Starting Media Stream ${msg.streamSid}`);
                // // Create Stream to the Google Speech to Text API
                recognizeStream = client
                    .streamingRecognize(request)
                    .on("error", console.error)
                    .on("data", data => {
                        console.log(data.results[0].alternatives[0].transcript);
                        const twimlRespuesta = `
                        <Response>
                            <Say voice="Polly.Mia" language="es-MX">Prueba de respuesta desde AP </Say>
                        </Response>
                    `;
                        ws.send(twimlRespuesta);
                        wss.clients.forEach(client => {
                            if (client.readyState === WebSocket.OPEN) {
                                client.send(
                                    JSON.stringify({
                                        event: "interim-transcription",
                                        text: data.results[0].alternatives[0].transcript
                                    })
                                );
                            }
                        });
                    });
                break;
            case "media":
                // Write Media Packets to the recognize stream
                // console.log(`Receiving Audio...`)
                recognizeStream.write(msg.media.payload);
                const twimlRespuesta = `
                <Response>
                    <Say voice="Polly.Mia" language="es-MX">Prueba de respuesta desde AP </Say>
                </Response>
            `;
                ws.send(twimlRespuesta);
                break;
            case "stop":
                console.log(`Call Has Ended`);
                recognizeStream.destroy();
                break;
        }
    });
});

app.use(express.static("public"));
//Handle HTTP Request
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "/index.html")));

app.post("/", (req, res) => {
    res.set("Content-Type", "text/xml");

    res.send(`
    <Response>
      <Start>
        <Stream url="wss://${req.headers.host}/"/>
      </Start>
      <Say  voice="Polly.Mia" language="es-MX">Prueba 3Q Diego, Inicia transcripcion de llamada 3Q  </Say>
      <Pause length="60" />
    </Response>
  `);
});


app.post("/message", (req, res) => {
    res.set("Content-Type", "text/xml");
    const { message } = req.body;

    res.send(`
      <Response>
        <Start>
          <Stream url="wss://${req.headers.host}/"/>
        </Start>
        <Say>${message}</Say>
        <Pause length="60" />
      </Response>
    `);

});

console.log("Listening on Port 8080");
server.listen(8080);