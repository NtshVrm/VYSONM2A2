import app from "..";
import request from "supertest";
import { AppDataSource } from "../db/db.datasource";
import { Users } from "../models/users.model";
import { URLShortener } from "../models/url-shortener.model";

const API_KEY = "test_api_key";
const ENT_API_KEY = "ent_test_api_key";

beforeAll(async () => {
  try {
    await AppDataSource.initialize();
    const userRepo = AppDataSource.getRepository(Users);
    const user = await userRepo.findOne({ where: { api_key: API_KEY } });
    if (user) {
      const urlRepo = AppDataSource.getRepository(URLShortener);
      await urlRepo.delete({ user: { id: user.id } });
    }
  } catch (err) {
    console.error("Test setup failed:", err);
    throw err;
  }
});

afterAll(async () => {
  try {
    await AppDataSource.destroy();
    await new Promise((resolve) => setTimeout(resolve, 1000));
  } catch (err) {
    console.error("Test cleanup failed:", err);
    throw err;
  }
});

// Silence console logs during tests
beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("POST /shorten", () => {
  const original_url = "https://example.com";
  let short_code = "";

  it("should fail if API KEY is not given", async () => {
    const response = await request(app).post("/shorten").send({ long_url: "" });
    expect(response.status).toBe(403);
    expect(response.body.error).toBe("API key is required.");
  });

  it("should return 400 for empty URL", async () => {
    const response = await request(app)
      .post("/shorten")
      .set("api-key", API_KEY)
      .send({ long_url: "" });
    expect(response.status).toBe(400);
    expect(response.body).toBeDefined();
    expect(response.body.short_code).not.toBeDefined();
    expect(response.body.error).not.toBe("");
    expect(response.body.error).toBe("Original long URL is required!");
  });

  it("should create a new short code and return it", async () => {
    const response = await request(app)
      .post("/shorten")
      .set("api-key", API_KEY)
      .send({
        long_url: original_url,
      });
    short_code = response.body.short_code;

    expect(response.status).toBe(201);
    expect(response.body).toBeDefined();
    expect(response.body.short_code).toBeDefined();
    expect(response.body.short_code).not.toBeNull();
    expect(response.body.short_code).not.toBe("");
    expect(response.body.expiry_date).toBeDefined();
    expect(response.body.expiry_date).toBe(null);
  });

  it("should create new short code for duplicate URL", async () => {
    const response = await request(app)
      .post("/shorten")
      .set("api-key", API_KEY)
      .send({
        long_url: original_url,
      });
    expect(response.status).toBe(201);
    expect(response.body).toBeDefined();
    expect(response.body.short_code).toBeDefined();
    expect(response.body.short_code).not.toBeNull();
    expect(response.body.short_code).not.toBe("");
    expect(response.body.short_code).not.toBe(short_code);
    expect(response.body.expiry_date).toBeDefined();
    expect(response.body.expiry_date).toBe(null);
  });

  it("should not allow access if user does not exist", async () => {
    const response = await request(app)
      .post("/shorten")
      .set("api-key", "random")
      .send({
        long_url: original_url,
      });
    expect(response.status).toBe(404);
    expect(response.body).toBeDefined();
    expect(response.body.error).not.toBe("");
    expect(response.body.error).toBe("User does not exist.");
  });

  it("should create with custom short code", async () => {
    const customCode = "abc123";
    const response = await request(app)
      .post("/shorten")
      .set("api-key", API_KEY)
      .send({
        long_url: original_url,
        custom_code: customCode,
      });
    expect(response.status).toBe(201);
    expect(response.body).toBeDefined();
    expect(response.body.short_code).toBeDefined();
    expect(response.body.short_code).not.toBeNull();
    expect(response.body.short_code).not.toBe("");
    expect(response.body.short_code).toBe(customCode);
    expect(response.body.expiry_date).toBeDefined();
    expect(response.body.expiry_date).toBe(null);
  });

  it("should return error if custom short code already exists", async () => {
    const customCode = "abc123";
    const response = await request(app)
      .post("/shorten")
      .set("api-key", API_KEY)
      .send({
        long_url: original_url,
        custom_code: customCode,
      });
    expect(response.status).toBe(400);
    expect(response.body).toBeDefined();
    expect(response.body.error).not.toBe("");
    expect(response.body.error).toBe(
      "Short code already exists, please try with a different code."
    );
  });

  it("should set expiry date if given", async () => {
    const response = await request(app)
      .post("/shorten")
      .set("api-key", API_KEY)
      .send({
        long_url: original_url,
        custom_code: "xyz789",
        expiry_date: "2025-02-06T18:36:24.585Z",
      });
    expect(response.status).toBe(201);
    expect(response.body).toBeDefined();
    expect(response.body.short_code).toBeDefined();
    expect(response.body.short_code).not.toBeNull();
    expect(response.body.short_code).not.toBe("");
    expect(response.body.short_code).toBe("xyz789");
    expect(response.body.expiry_date).toBeDefined();
    expect(response.body.expiry_date).toBe("2025-02-06T18:36:24.585Z");
  });
});

describe("GET /redirect", () => {
  const original_url = "https://example.com";
  const short_code = "test123";

  beforeEach(async () => {
    // test URL to use for redirect tests
    await request(app).post("/shorten").set("api-key", API_KEY).send({
      long_url: original_url,
      custom_code: short_code,
    });
  });

  it("should fail if API KEY is not given", async () => {
    const response = await request(app).get("/redirect?code=test123");
    expect(response.status).toBe(403);
    expect(response.body.error).toBe("API key is required.");
  });

  it("should return 400 if code isn't given", async () => {
    const response = await request(app)
      .get("/redirect")
      .set("api-key", API_KEY);
    expect(response.status).toBe(400);
    expect(response.body).toBeDefined();
    expect(response.body.error).toBe("Short code is required.");
  });

  it("should return 404 if short code is not found", async () => {
    const response = await request(app)
      .get("/redirect?code=nonexistent")
      .set("api-key", API_KEY);
    expect(response.status).toBe(404);
    expect(response.body).toBeDefined();
    expect(response.body.error).toBe("Short code does not exist.");
  });

  it("should return 404 if user does not exist", async () => {
    const response = await request(app)
      .get("/redirect?code=test123")
      .set("api-key", "random");
    expect(response.status).toBe(404);
    expect(response.body).toBeDefined();
    expect(response.body.error).toBe("User does not exist.");
  });

  it("should redirect to original URL if short code exists", async () => {
    const response = await request(app)
      .get(`/redirect?code=${short_code}`)
      .set("api-key", API_KEY);
    expect(response.status).toBe(302);
    expect(response.header.location).toBe(original_url);
  });

  it("should return 410 if URL has expired", async () => {
    // URL with expiry date in the past
    const expiredCode = "expired123";
    await request(app).post("/shorten").set("api-key", API_KEY).send({
      long_url: original_url,
      custom_code: expiredCode,
      expiry_date: "2020-01-01T00:00:00.000Z",
    });

    const response = await request(app)
      .get(`/redirect?code=${expiredCode}`)
      .set("api-key", API_KEY);
    expect(response.status).toBe(410);
    expect(response.body.error).toBe("Short code has expired!");
  });
});

describe("DELETE /delete", () => {
  const original_url = "https://example.com";
  const short_code = "delete123";

  beforeEach(async () => {
    // test URL to use for delete tests
    await request(app).post("/shorten").set("api-key", API_KEY).send({
      long_url: original_url,
      custom_code: short_code,
    });
  });

  it("should fail if API KEY is not given", async () => {
    const response = await request(app)
      .delete("/delete")
      .send({ short_code: "test" });
    expect(response.status).toBe(403);
    expect(response.body.error).toBe("API key is required.");
  });

  it("should return 400 if short code is not given", async () => {
    const response = await request(app)
      .delete("/delete")
      .set("api-key", API_KEY)
      .send({});
    expect(response.status).toBe(400);
    expect(response.body).toBeDefined();
    expect(response.body.error).toBe("Short code is required.");
  });

  it("should return 404 if short code is not found", async () => {
    const response = await request(app)
      .delete("/delete")
      .set("api-key", API_KEY)
      .send({ short_code: "nonexistent" });
    expect(response.status).toBe(404);
    expect(response.body).toBeDefined();
    expect(response.body.error).toBe("Short code does not exist.");
  });

  it("should return 404 if user does not exist", async () => {
    const response = await request(app)
      .delete("/delete")
      .set("api-key", "random")
      .send({ short_code });
    expect(response.status).toBe(404);
    expect(response.body).toBeDefined();
    expect(response.body.error).toBe("User does not exist.");
  });

  it("should successfully delete an existing short code", async () => {
    const response = await request(app)
      .delete("/delete")
      .set("api-key", API_KEY)
      .send({ short_code });
    expect(response.status).toBe(200);
    expect(response.body).toBeDefined();
    expect(response.body.message).toBe(`${short_code} deleted successfully!`);
  });

  it("should return 410 if trying to delete an expired URL", async () => {
    const expiredCode = "expired456";
    // expired URL
    await request(app).post("/shorten").set("api-key", API_KEY).send({
      long_url: original_url,
      custom_code: expiredCode,
      expiry_date: "2020-01-01T00:00:00.000Z",
    });

    const response = await request(app)
      .delete("/delete")
      .set("api-key", API_KEY)
      .send({ short_code: expiredCode });
    expect(response.status).toBe(410);
    expect(response.body.error).toBe("Short code has expired!");
  });
});

describe("PUT /code/:shortCode", () => {
  const original_url = "https://example.com";
  const short_code = "update123";

  beforeEach(async () => {
    await request(app).post("/shorten").set("api-key", API_KEY).send({
      long_url: original_url,
      custom_code: short_code,
    });
  });

  it("should fail if API KEY is not given", async () => {
    const response = await request(app)
      .put(`/code/${short_code}`)
      .send({ expiry_date: "2025-01-01T00:00:00.000Z" });
    expect(response.status).toBe(403);
    expect(response.body.error).toBe("API key is required.");
  });

  it("should return 400 if short code is not found", async () => {
    const response = await request(app)
      .put("/code/nonexistent")
      .set("api-key", API_KEY)
      .send({ expiry_date: "2025-01-01T00:00:00.000Z" });
    expect(response.status).toBe(400);
    expect(response.body).toBeDefined();
    expect(response.body.error).toBe("Short code does not exist.");
  });

  it("should successfully update expiry date", async () => {
    const newExpiryDate = "2025-01-01T00:00:00.000Z";
    const response = await request(app)
      .put(`/code/${short_code}`)
      .set("api-key", API_KEY)
      .send({ expiry_date: newExpiryDate });
    expect(response.status).toBe(201);
    expect(response.body).toBeDefined();
    expect(response.body.short_code).toBe(short_code);
  });

  it("should handle null expiry date", async () => {
    const response = await request(app)
      .put(`/code/${short_code}`)
      .set("api-key", API_KEY)
      .send({ expiry_date: null });
    expect(response.status).toBe(201);
    expect(response.body).toBeDefined();
    expect(response.body.short_code).toBe(short_code);
  });
});

describe("POST /shorten-bulk", () => {
  const urls = ["https://example1.com", "https://example2.com"];

  it("should fail if API KEY is not given", async () => {
    const response = await request(app)
      .post("/shorten-bulk")
      .send({ long_urls: urls });
    expect(response.status).toBe(403);
    expect(response.body.error).toBe("API key is required.");
  });

  it("should return 400 if URLs array is empty", async () => {
    const response = await request(app)
      .post("/shorten-bulk")
      .set("api-key", ENT_API_KEY)
      .send({ long_urls: [] });
    expect(response.status).toBe(400);
    expect(response.body).toBeDefined();
    expect(response.body.error).toBe("Original long URL's are required!");
  });

  it("should return 400 if URLs array is not provided", async () => {
    const response = await request(app)
      .post("/shorten-bulk")
      .set("api-key", ENT_API_KEY)
      .send({});
    expect(response.status).toBe(400);
    expect(response.body).toBeDefined();
    expect(response.body.error).toBe("Original long URL's are required!");
  });

  it("should successfully create multiple short codes", async () => {
    const response = await request(app)
      .post("/shorten-bulk")
      .set("api-key", ENT_API_KEY)
      .send({ long_urls: urls });
    expect(response.status).toBe(201);
    expect(response.body).toBeDefined();
    expect(response.body.batch).toBeInstanceOf(Array);
    expect(response.body.batch).toHaveLength(urls.length);
    response.body.batch.forEach((item: any, index: number) => {
      expect(item.original_url).toBe(urls[index]);
      expect(item.short_code).toBeDefined();
      expect(item.short_code).not.toBeNull();
    });
  });

  it("should return 400 if user is not enterprise tier", async () => {
    const response = await request(app)
      .post("/shorten-bulk")
      .set("api-key", API_KEY)
      .send({ long_urls: urls });
    expect(response.status).toBe(400);
    expect(response.body).toBeDefined();
    expect(response.body.error).toBe(
      "You do not have access for this operation."
    );
  });
});
