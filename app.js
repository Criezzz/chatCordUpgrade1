import express from "express";
import http from "http";
import authRoute from './routes/auth.js';
import homeRoute from './routes/home.js';
import makepath from "./configs/path.js";
import cors from "cors";
import initSocketIo from "./configs/socketio.js";
import { availableParallelism } from 'node:os';
import cluster from 'node:cluster';
import { setupPrimary } from '@socket.io/cluster-adapter';


// QUAN TRỌNG: dùng PORT của Cloud Run và bind 0.0.0.0
const PORT = Number(process.env.PORT) || 8080;


  const app = express();
  app.use(express.static(makepath("")));
  app.use(express.json());
  app.use(authRoute);
  app.use(homeRoute);
  app.use("/chat", cors(
    {
      origin: "http://localhost:3000",
      methods: ["GET", "POST"]
    }
  ))
  app.get('/_ah/health', (req, res) => res.status(200).send('ok'));
  
  const server = http.createServer(app);
  const io = await initSocketIo(server);
  
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });


