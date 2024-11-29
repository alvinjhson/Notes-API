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

    // Extract the note ID from the path parameters
    const noteId = event.pathParameters?.id;

    if (!noteId) {
        return sendResponse(400, { success: false, message: "Note ID is required." });
    }

    // Fetch the note from the database
    const note = await getNoteFromDB(noteId);

    if (!note) {
        return sendResponse(404, { success: false, message: "Note not found." });
    }

    // Ensure the note is not deleted
    if (note.isDeleted) {
        return sendResponse(403, { success: false, message: "The note has been deleted." });
    }

    // Extract user information from the event
    const { id: userId } = event.user;

    // Ensure the user is authorized to access this note
    if (note.userId !== userId) {
        return sendResponse(403, { success: false, message: "You are not authorized to access this note." });
    }

    // Return the note
    return sendResponse(200, { success: true, note });
};

// Wrap the handler with Middy middleware
const handler = middy(baseHandler)
    .use(validateToken) 
    .onError((error) => {
        console.error("Unhandled error:", error.message);
        return sendResponse(500, { success: false, message: "Internal Server Error" });
    });

module.exports = { handler };
