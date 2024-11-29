const middy = require("@middy/core");
const AWS = require("aws-sdk");
const { sendResponse } = require("../../responses");
const { validateToken } = require("../../middleware/auth");
const db = new AWS.DynamoDB.DocumentClient();

async function restoreNoteInDB(noteId, userId) {
    try {
        const params = {
            TableName: "notes",
            Key: { id: noteId },
            UpdateExpression: "set isDeleted = :isDeleted, modifiedAt = :modifiedAt",
            ConditionExpression: "userId = :userId AND isDeleted = :currentDeleted",
            ExpressionAttributeValues: {
                ":isDeleted": false,
                ":modifiedAt": new Date().toISOString(),
                ":userId": userId,
                ":currentDeleted": true, 
            },
            ReturnValues: "ALL_NEW",
        };

        const result = await db.update(params).promise();
        return result.Attributes;
    } catch (error) {
        if (error.name === "ConditionalCheckFailedException") {
            console.error("Restore failed. Note not found or not authorized:", { noteId, userId });
            return { error: "Unauthorized or Note Not Found" };
        }
        console.error("Error restoring note:", error.message);
        throw new Error("Internal Server Error");
    }
}


const baseHandler = async (event) => {
    console.log("Event received:", JSON.stringify(event));
    
    const noteId = event.pathParameters?.id;
    if (!noteId) {
        console.error("Missing note ID.");
        return sendResponse(400, { success: false, message: "Note ID is required." });
    }

    const { id: userId } = event.user || {};
    if (!userId) {
        console.error("Missing user ID in event.user.");
        return sendResponse(401, { success: false, message: "Unauthorized" });
    }

    const restoredNote = await restoreNoteInDB(noteId, userId);

    if (restoredNote.error) {
        console.error("Failed to restore note:", restoredNote.error);
        return sendResponse(400, { success: false, message: restoredNote.error });
    }

    return sendResponse(200, { success: true, note: restoredNote, message: "Note succesfully restored" });
};


const handler = middy(baseHandler)
    .use(validateToken)
    .onError((error) => {
        console.error("Unhandled error:", error.message);
        return sendResponse(500, { success: false, message: "Internal Server Error" });
    });

module.exports = { handler };
