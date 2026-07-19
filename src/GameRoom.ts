import { Room, Client } from "colyseus";
import { Schema, MapSchema } from "@colyseus/schema";

class PlayerState extends Schema {
  x: number = 0;
  y: number = 0;
  z: number = 0;
  rotationY: number = 0;
  health: number = 100;
  isDead: boolean = false;
  characterId: string = "a";
  weaponId: string = "m4a1";
  team: string = "A";
}

class GameState extends Schema {
  players = new MapSchema<PlayerState>();
  teamAScore: number = 0;
  teamBScore: number = 0;
  gamePhase: string = "waiting";
  timeRemaining: number = 300;
}

export class GameRoom extends Room<GameState> {
  maxClients = 8;

  onCreate() {
    this.setState(new GameState());

    this.setSimulationInterval((dt) => {
      if (this.state.gamePhase === "playing") {
        this.state.timeRemaining -= dt / 1000;
        if (this.state.timeRemaining <= 0) {
          this.state.gamePhase = "ended";
          this.broadcast("game_ended", {
            teamAScore: this.state.teamAScore,
            teamBScore: this.state.teamBScore
          });
        }
      }
    }, 1000);

    this.onMessage("move", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (player && !player.isDead) {
        player.x = data.x;
        player.y = data.y;
        player.z = data.z;
        player.rotationY = data.rotationY;
      }
    });

    this.onMessage("shoot", (client, data) => {
      const shooter = this.state.players.get(client.sessionId);
      if (!shooter || shooter.isDead) return;
      if (data.hitPlayerId) {
        const target = this.state.players.get(data.hitPlayerId);
        if (target && !target.isDead && target.team !== shooter.team) {
          target.health -= data.damage;
          if (target.health <= 0) {
            target.health = 0;
            target.isDead = true;
            if (shooter.team === "A") {
              this.state.teamAScore += 1;
            } else {
              this.state.teamBScore += 1;
            }
            this.clock.setTimeout(() => {
              target.health = 100;
              target.isDead = false;
            }, 3000);
          }
        }
      }
      this.broadcast("player_shot", {
        shooterId: client.sessionId,
        hitPlayerId: data.hitPlayerId,
        hitPoint: data.hitPoint
      });
    });

    this.onMessage("use_ability", (client, data) => {
      this.broadcast("ability_used", {
        playerId: client.sessionId,
        ability: data.ability
      });
    });
  }

  onJoin(client: Client, options: any) {
    const player = new PlayerState();
    const teamACount = Array.from(this.state.players.values())
      .filter(p => p.team === "A").length;
    const teamBCount = Array.from(this.state.players.values())
      .filter(p => p.team === "B").length;
    player.team = teamACount <= teamBCount ? "A" : "B";
    player.characterId = options.characterId || "a";
    player.weaponId = options.weaponId || "m4a1";
    player.x = player.team === "A" ? -10 : 10;
    player.y = 0;
    player.z = 0;
    this.state.players.set(client.sessionId, player);
    if (this.state.players.size >= 2 && this.state.gamePhase === "waiting") {
      this.state.gamePhase = "playing";
      this.state.timeRemaining = 300;
      this.broadcast("game_started", {});
    }
    console.log(`Player joined: ${client.sessionId}, Team: ${player.team}`);
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    console.log(`Player left: ${client.sessionId}`);
  }

  onDispose() {
    console.log("Room disposed");
  }
}
