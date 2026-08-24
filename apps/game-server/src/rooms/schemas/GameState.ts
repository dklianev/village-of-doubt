import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";

export class PlayerPublicState extends Schema {
  @type("string") userId = "";
  @type("string") displayName = "";
  @type("string") avatarId = "portrait-m01";
  @type("boolean") connected = true;
  @type("boolean") ready = false;
  @type("boolean") playing = true;
  @type("boolean") alive = true;
  @type("boolean") host = false;
  @type("boolean") narrator = false;
  @type("boolean") acceptedFullNarrator = false;
  @type("boolean") mayor = false;
  @type("boolean") hasVoted = false;
  /**
   * Legacy client compatibility only. It intentionally remains false: exposing
   * night-action completion lets observers infer which players hold active roles.
   */
  @type("boolean") actedThisPhase = false;
  /**
   * Set only after death and only when revealRolesOnDeath is true.
   * Empty string while the player is alive — never leaks live role data.
   */
  @type("string") revealedRole = "";
}

export class PublicEventState extends Schema {
  @type("string") id = "";
  @type("number") round = 0;
  @type("string") phase = "lobby";
  @type("string") type = "system";
  @type("string") messageBg = "";
  @type("number") createdAt = Date.now();
}

export class ChatMessageState extends Schema {
  @type("string") id = "";
  @type("string") channel = "public";
  @type("string") senderUserId = "";
  @type("string") senderName = "";
  @type("string") message = "";
  @type("number") createdAt = Date.now();
}

export class RoleCountState extends Schema {
  @type("string") role = "";
  @type("number") count = 0;
}

export class VoteTallyState extends Schema {
  @type("string") targetUserId = "";
  @type("string") targetName = "";
  @type("number") count = 0;
  @type("boolean") hasMayorVote = false;
}

export class NominationState extends Schema {
  @type("string") nominatorUserId = "";
  @type("string") targetUserId = "";
}

export class GameState extends Schema {
  @type("string") code = "";
  @type("string") mode = "werewolves_classic";
  @type("number") playerCount = 0;
  @type("string") narratorMode = "automatic";
  @type("string") communicationMode = "built_in_chat";
  @type("string") tempoProfile = "normal_online";
  @type("number") dayDiscussionSeconds = 0;
  @type("number") playerSpeechSeconds = 0;
  @type("number") voteSeconds = 0;
  @type("boolean") revealRolesOnDeath = true;
  @type("boolean") loversEnabled = false;
  @type("boolean") doctorCanSelfProtect = false;
  @type("boolean") allowSkipVote = true;
  @type("string") majorityMode = "simple";
  @type("string") narratorVoice = "classic";
  @type("string") phase = "lobby";
  @type("string") rulesetVersion = "";
  @type("number") round = 0;
  @type("number") phaseEndsAt = 0;
  @type("string") currentSpeakerUserId = "";
  @type("string") currentDefenseUserId = "";
  @type("boolean") locked = false;
  @type("string") winnerTeam = "";
  @type("string") winnerReasonBg = "";
  @type({ map: PlayerPublicState }) players = new MapSchema<PlayerPublicState>();
  @type([RoleCountState]) roleCounts = new ArraySchema<RoleCountState>();
  @type([NominationState]) nominations = new ArraySchema<NominationState>();
  @type(["string"]) revoteEligibleUserIds = new ArraySchema<string>();
  @type([VoteTallyState]) voteTally = new ArraySchema<VoteTallyState>();
  @type([PublicEventState]) publicEvents = new ArraySchema<PublicEventState>();
  @type([ChatMessageState]) publicChat = new ArraySchema<ChatMessageState>();
}
