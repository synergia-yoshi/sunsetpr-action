import OpenAI from "openai";

const client = new OpenAI();
client.responses.create({ model: "gpt-5-chat-latest", input: "hello" });
client.responses.create({ model: process.env.OPENAI_MODEL, input: "hello" });
