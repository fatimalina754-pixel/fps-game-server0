import express from "express";
import cors from "cors";
import { Server } from "colyseus";
import { createServer } from "http";
import { GameRoom } from "./GameRoom";

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const gameServer = new Server({ server: httpServer });

gameServer.define("game_room", GameRoom);

app.get("/", (req, res) => {
  res.json({ status: "FPS Game Server Running" });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Game server running on port ${PORT}`);
});
