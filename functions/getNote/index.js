const AWS = require("aws-sdk");
const middy = require("@middy/core");
const { sendResponse } = require("../../responses");
const { validateToken } = require("../../middleware/auth");

const db = new AWS.DynamoDB.DocumentClient();

async function getNoteFromDB(noteId) {
    try {
        const result = await db.get({
            TableName: "notes",
            Key: { id: noteId },
        }).promise();

        return result.Item; 
    } catch (error) {
        console.error("Error fetching note:", error.message);
        throw new Error("Internal Server Error");
    }
}

const baseHandler = async (event) => {
    console.log("Event received:", JSON.stringify(event)); 

    const noteId = event.pathParameters?.id;

    if (!noteId) {
        return sendResponse(400, { success: false, message: "Note ID is required." });
    }

    const note = await getNoteFromDB(noteId);

    if (!note) {
        return sendResponse(404, { success: false, message: "Note not found." });
    }

    if (note.isDeleted) {
        return sendResponse(404, { success: false, message: "The note has been deleted." });
    }

    const { id: userId } = event.user;

    if (note.userId !== userId) {
        return sendResponse(401, { success: false, message: "You are not authorized to access this note." });
    }

    return sendResponse(200, { success: true, note , message: "Note retrieved successfully" });
};

const handler = middy(baseHandler)
    .use(validateToken) 
    .onError((error) => {
        console.error("Unhandled error:", error.message);
        return sendResponse(500, { success: false, message: "Internal Server Error" });
    });

module.exports = { handler };
