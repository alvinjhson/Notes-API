const middy = require("@middy/core");
const AWS = require("aws-sdk");
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


async function updateNoteInDB(noteId, userId, updatedFields) {
    try {
        const params = {
            TableName: "notes",
            Key: { id: noteId },
            UpdateExpression: "set title = :title, #text = :text, modifiedAt = :modifiedAt", 
            ConditionExpression: "userId = :userId",
            ExpressionAttributeValues: {
                ":title": updatedFields.title,
                ":text": updatedFields.text,
                ":modifiedAt": new Date().toISOString(),
                ":userId": userId,
            },
            ExpressionAttributeNames: {
                "#text": "text", 
            },
            ReturnValues: "ALL_NEW",
        };

        const result = await db.update(params).promise();
        return result.Attributes; 
    } catch (error) {
        if (error.name === "ConditionalCheckFailedException") {
            console.error("Unauthorized access attempt:", { noteId, userId });
            return { error: "Unauthorized" }; 
        }
        console.error("Unexpected error while updating note:", { error });
        throw new Error("Internal Server Error");
    }
}



const baseHandler = async (event) => {
    console.log("Event received:", JSON.stringify(event));

    const noteId = event.pathParameters?.id;
    if (!noteId) {
        return sendResponse(400, { success: false, message: "Note ID is required." });
    }

    const { id: userId } = event.user;
    if (!userId) {
        return sendResponse(401, { success: false, message: "Unauthorized" });
    }

    const note = await getNoteFromDB(noteId);
    if (!note) {
        return sendResponse(404, { success: false, message: "Note not found." });
    }

    if (note.userId !== userId) {
        return sendResponse(403, { success: false, message: "You are not authorized to update this note." });
    }

    let parsedBody;
    try {
        parsedBody = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    } catch (error) {
        console.error("Invalid JSON body:", error.message);
        return sendResponse(400, { success: false, message: "Invalid request body." });
    }

    const { title, text } = parsedBody || {};
    if (!title || title.length > 50) {
        return sendResponse(400, { success: false, message: "Title is required and must be 50 characters or less." });
    }
    if (!text || text.length > 300) {
        return sendResponse(400, { success: false, message: "Text is required and must be 300 characters or less." });
    }

    const updatedFields = { title, text };
    const updatedNote = await updateNoteInDB(noteId, userId, updatedFields);

    if (updatedNote.error === "Unauthorized") {
        return sendResponse(403, { success: false, message: "Unauthorized access." });
    }

    return sendResponse(200, { success: true, note: updatedNote });
};

const handler = middy(baseHandler)
    .use(validateToken)
    .onError((error) => {
        console.error("Unhandled error:", error.message || error);
        return sendResponse(500, { success: false, message: "Internal Server Error" });
    });

module.exports = { handler };
