import app from "..";
import request from "supertest";
import { AppDataSource } from "../db/db.datasource";

beforeAll(async () => {
  await AppDataSource.initialize();
});

afterAll(async () => {
  // Close the connection after all tests
  await AppDataSource.destroy();
  // Give time for connections to close
  await new Promise((resolve) => setTimeout(resolve, 500));
});

describe("SEED DATE TEST POST /shorten", () => {
  it("return short code of seed data 2", async () => {
    const response = await request(app).post("/shorten").send({
      long_url: "https://google.com",
    });
    expect(response.status).toBe(201);
    expect(response.body).toBeDefined();
    expect(response.body.short_code).toBeDefined();
    expect(response.body.short_code).not.toBeNull();
    expect(response.body.short_code).not.toBe("");
    expect(response.body.short_code).toBe("xyz789");
  });
});

describe("SEED DATA TEST GET /redirect", () => {
  it("redirect to seed data long url 2", async () => {
    const response = await request(app).get("/redirect?code=xyz789");
    expect(response.status).toBe(302);
    expect(response.header.location).toBe("https://google.com");
  });
});

describe("Verify redirect after creating short code", () => {
  it("shorten url and redirect to original url", async () => {
    const original_url = "https://m.cricbuzz.com";

    const response = await request(app).post("/shorten").send({
      long_url: original_url,
    });

    const short_code = response.body.short_code;
    expect(response.status).toBe(201);
    expect(response.body).toBeDefined();
    expect(response.body.short_code).toBeDefined();
    expect(response.body.short_code).not.toBeNull();
    expect(response.body.short_code).not.toBe("");

    const redirectResponse = await request(app).get(
      `/redirect?code=${short_code}`
    );
    expect(redirectResponse.status).toBe(302);
    expect(redirectResponse.header.location).toBe(original_url);
  });
});

describe("POST /shorten", () => {
  const original_url = "https://youtube.com";
  let short_code = "";
  it("should create a new short code and return it", async () => {
    const response = await request(app).post("/shorten").send({
      long_url: original_url,
    });

    short_code = response.body.short_code;

    expect(response.status).toBe(201);
    expect(response.body).toBeDefined();
    expect(response.body.short_code).toBeDefined();
    expect(response.body.short_code).not.toBeNull();
    expect(response.body.short_code).not.toBe("");
  });

  it("should return already existing short code for duplicate URL", async () => {
    const response = await request(app).post("/shorten").send({
      long_url: original_url,
    });
    expect(response.status).toBe(201);
    expect(response.body).toBeDefined();
    expect(response.body.short_code).toBeDefined();
    expect(response.body.short_code).not.toBeNull();
    expect(response.body.short_code).not.toBe("");
    expect(response.body.short_code).toBe(short_code);
  });

  it("should return 400 if url isnt given", async () => {
    const response = await request(app).post("/shorten").send({});
    expect(response.status).toBe(400);
    expect(response.body).toBeDefined();
    expect(response.body.short_code).not.toBeDefined();
    expect(response.body.error).not.toBe("");
    expect(response.body.error).toBe("Original long URL is required!");
  });
});

describe("GET /redirect", () => {
  it("should return 400 is code isnt given", async () => {
    const response = await request(app).get("/redirect");
    expect(response.status).toBe(400);
    expect(response.body).toBeDefined();
    expect(response.body.error).toBe("Short code is required.");
  });

  it("should return 404 if short code is not found", async () => {
    const response = await request(app).get("/redirect?code=AaBbCc");
    expect(response.status).toBe(404);
    expect(response.body).toBeDefined();
    expect(response.body.error).toBe("Short code does not exist.");
  });

  it("should redirect to original URL if short code exists", async () => {
    const short_code = "xyz789"; //using the seed data here

    const expected_original_url = "https://google.com";
    const redirectResponse = await request(app).get(
      `/redirect?code=${short_code}`
    );
    expect(redirectResponse.status).toBe(302);
    expect(redirectResponse.header.location).toBe(expected_original_url);
  });
});

describe("DELETE /delete", () => {
  it("should return 400 if short code is not given", async () => {
    const response = await request(app).delete("/delete");
    expect(response.status).toBe(400);
    expect(response.body).toBeDefined();
    expect(response.body.error).toBe("Short code is required.");
  });

  it("should return 404 if short code is not found", async () => {
    const short_code = "AaBbCc";
    const response = await request(app).delete("/delete").send({
      short_code: short_code,
    });
    expect(response.status).toBe(404);
    expect(response.body).toBeDefined();
    expect(response.body.error).toBe("Short code does not exist.");
  });

  it("should return deleted short_code on success", async () => {
    const short_code = "abc123";
    const response = await request(app).delete("/delete").send({
      short_code: short_code,
    });

    expect([200, 404]).toContain(response.status);

    if (response.status == 200) {
      expect(response.body).toBeDefined();
      expect(response.body.message).toBe(`${short_code} deleted successfully!`);
    }

    if (response.status == 404) {
      expect(response.body).toBeDefined();
      expect(response.body.error).toBe("Short code does not exist.");
    }
  });

  it("redirect to deleted code should fail", async () => {
    const response = await request(app).get(`/redirect?code=abc123`);
    expect(response.status).toBe(404);
    expect(response.body).toBeDefined();
    expect(response.body.error).toBe("Short code does not exist.");
  });
});
