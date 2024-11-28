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
            ConditionExpression: "userId = :userId", 
            ExpressionAttributeValues: {
                ":userId": userId,
            },
        };

        await db.delete(params).promise();
        return { success: true };
    } catch (error) {
        if (error.name === "ConditionalCheckFailedException") {
            console.error("Unauthorized deletion attempt:", { noteId, userId });
            return { success: false, error: "Unauthorized" }; 
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


    const { id: userId } = event.user || {}; 
    if (!userId) {
        console.error("Unauthorized: userId is missing from event.user");
        return sendResponse(401, { success: false, message: "Unauthorized" });
    }


    const result = await deleteNoteFromDB(noteId, userId);

    if (!result.success) {
        return sendResponse(403, { success: false, message: "Unauthorized access." });
    }

    return sendResponse(200, { success: true, message: "Note deleted successfully." });
};

const handler = middy(baseHandler)
    .use(validateToken) 
    .onError((error) => {
        console.error("Unhandled error:", error.message);
        return sendResponse(500, { success: false, message: "Internal Server Error" });
    });

module.exports = { handler };
