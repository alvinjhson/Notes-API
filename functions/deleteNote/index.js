const middy = require("@middy/core");
const AWS = require("aws-sdk");
const { sendResponse } = require("../../responses");
const { validateToken } = require("../../middleware/auth");

const db = new AWS.DynamoDB.DocumentClient();

async function deleteNoteFromDB(noteId, userId) {
    try {
        const params = {
            TableName: "notes",
            Key: { id: noteId },
            UpdateExpression: "set isDeleted = :isDeleted, modifiedAt = :modifiedAt",
            ConditionExpression: "userId = :userId", 
            ExpressionAttributeValues: {
                ":isDeleted": true,
                ":modifiedAt": new Date().toISOString(),
                ":userId": userId,
            },
            ReturnValues: "ALL_NEW",
        };

        const result = await db.update(params).promise();
        if (!result.Attributes) {
            console.error("Note not found or already deleted:", { noteId, userId });
            return { error: "Note not found" };
        }
        return result.Attributes;
    } catch (error) {
        if (error.name === "ConditionalCheckFailedException") {
            console.error("Condition check failed. Note ID or user ID mismatch:", { noteId, userId });
            return { error: "Unauthorized" };
        }
        console.error("Error deleting note:", error.message);
        throw new Error("Internal Server Error");
    }
}

const baseHandler = async (event) => {
    console.log("Event received:", JSON.stringify(event));

    const noteId = event.pathParameters?.id; 
    if (!noteId) {
        return sendResponse(400, { success: false, message: "Note ID is required." });
    }

    console.log("Extracted Note ID:", noteId);

    const { id: userId } = event.user || {}; 
    if (!userId) {
        console.error("Unauthorized: userId is missing from event.user");
        return sendResponse(401, { success: false, message: "Unauthorized" });
    }

    console.log("Extracted user ID:", userId);

    const result = await deleteNoteFromDB(noteId, userId);

    if (result.error === "Unauthorized") {
        return sendResponse(403, { success: false, message: "Unauthorized access." });
    }

    if (result.error === "Note not found") {
        return sendResponse(404, { success: false, message: "Note not found." });
    }
    
    return sendResponse(200, { success: true, message: "Note deleted successfully." });
};

const handler = middy(baseHandler)
    .use(validateToken) 
    .onError((error) => {
        console.error("Unhandled error:", error.message || error);
        return sendResponse(500, { success: false, message: "Internal Server Error" });
    });

module.exports = { handler };
