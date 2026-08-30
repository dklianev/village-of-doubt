import { NoneSerializer } from "@colyseus/sdk/serializer/NoneSerializer";
import { SchemaSerializer } from "@colyseus/sdk/serializer/SchemaSerializer";
import { getSerializer } from "@colyseus/sdk/serializer/Serializer";
import { describe, expect, it } from "vitest";
import { createGameClient } from "../colyseus-client";

describe("Colyseus client", () => {
  it("registers the serializers required by game rooms when using subpath imports", () => {
    createGameClient();

    expect(getSerializer("schema")).toBe(SchemaSerializer);
    expect(getSerializer("none")).toBe(NoneSerializer);
  });
});
