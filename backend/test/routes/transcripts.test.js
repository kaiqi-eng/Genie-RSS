import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import request from "supertest";
import { API_KEY } from "../helpers/api.js";
import { sampleTranscripts } from "../helpers/payloads.js";

const mockSummarizeTranscript = jest.fn();

jest.unstable_mockModule("../../src/services/otterTranscript.js", () => ({
  summarizeTranscript: mockSummarizeTranscript,
}));

const { default: app } = await import("../../src/index.js");

describe("Transcript Routes", () => {
  beforeEach(() => {
    mockSummarizeTranscript.mockReset();
  });

  describe("POST /api/transcript/summarize", () => {
    it("requires API key", async () => {
      await request(app)
        .post("/api/transcript/summarize")
        .send({ transcripts: sampleTranscripts })
        .expect(401);
    });

    it("validates transcripts payload", async () => {
      const res = await request(app)
        .post("/api/transcript/summarize")
        .set("X-API-Key", API_KEY)
        .send({})
        .expect(400);

      expect(res.body.error).toBe("Validation failed");
      expect(res.body.details[0].field).toBe("transcripts");
    });

    it("returns summarized transcript payload", async () => {
      mockSummarizeTranscript.mockResolvedValueOnce({
        summary: "Transcript summary",
      });

      const res = await request(app)
        .post("/api/transcript/summarize")
        .set("X-API-Key", API_KEY)
        .send({ transcripts: sampleTranscripts })
        .expect(200);

      expect(mockSummarizeTranscript).toHaveBeenCalledWith(sampleTranscripts);
      expect(res.body.summary).toBe("Transcript summary");
    });

    it("maps service errors to route error shape", async () => {
      mockSummarizeTranscript.mockRejectedValueOnce(new Error("upstream failure"));

      const res = await request(app)
        .post("/api/transcript/summarize")
        .set("X-API-Key", API_KEY)
        .send({ transcripts: sampleTranscripts })
        .expect(500);

      expect(res.body.error).toBe("Failed to summarize transcript");
      expect(res.body.details).toBe("upstream failure");
    });
  });
});
