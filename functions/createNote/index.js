const { nanoid } = require("nanoid");
const middy = require("@middy/core");
const AWS = require("aws-sdk");
const { sendResponse } = require("../../responses");
const { validateToken } = require("../../middleware/auth");

const db = new AWS.DynamoDB.DocumentClient();

async function saveNoteToDB(note) {
    try {
        await db.put({
            TableName: "notes",
            Item: note,
        }).promise();
    } catch (error) {
        console.error("Error saving note to DB:", error.stack);
        throw new Error("Internal Server Error");
    }
}

const baseHandler = async (event) => {
    console.log("Event received:", JSON.stringify(event));

 
    const parsedBody = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    const { title, text } = parsedBody;

 
    const { id: userId } = event.user || {};

    if (!userId) {
        console.error("Unauthorized: userId is missing from event.user");
        return sendResponse(401, { success: false, message: "Unauthorized" });
    }

    if (!title || title.length > 50) {
        console.error("Title validation failed:", title);
        return sendResponse(400, { success: false, message: "Title is required and must be 50 characters or less." });
    }

    if (!text || text.length > 300) {
        console.error("Text validation failed:", text);
        return sendResponse(400, { success: false, message: "Text is required and must be 300 characters or less." });
    }

    const note = {
        id: nanoid(),
        userId,
        title,
        text,
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
        isDeleted: false,
    };

    console.log("Note to be saved:", note);

    try {
        await saveNoteToDB(note);
        console.log("Note saved successfully");
    } catch (error) {
        console.error("Error saving note:", error.message);
        return sendResponse(500, { success: false, message: "Internal Server Error" });
    }

    return sendResponse(201, { success: true, note });
};

const handler = middy(baseHandler)
    .use(validateToken) 
    .onError((error) => {
        console.error("Unhandled error:", error.message);
        return sendResponse(500, { success: false, message: "Internal Server Error" });
    });

module.exports = { handler };

