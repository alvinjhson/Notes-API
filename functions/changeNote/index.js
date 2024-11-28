// const AWS = require("aws-sdk");
// const middy = require("@middy/core");
// const { sendResponse } = require("../../responses");
// const { validateToken } = require("../../middleware/auth");

// // Initialize DynamoDB Document Client
// const db = new AWS.DynamoDB.DocumentClient();

// // Function to update the note in DynamoDB
// async function updateNoteInDB(noteId, userId, updatedFields) {
//     try {
//         console.log("Preparing to update note in DB:", { noteId, userId, updatedFields });

//         const params = {
//             TableName: "notes",
//             Key: { id: noteId },
//             UpdateExpression: "set title = :title, text = :text, modifiedAt = :modifiedAt",
//             ConditionExpression: "userId = :userId", // Ensure the note belongs to the user
//             ExpressionAttributeValues: {
//                 ":title": updatedFields.title,
//                 ":text": updatedFields.text,
//                 ":modifiedAt": new Date().toISOString(),
//                 ":userId": userId,
//             },
//             ReturnValues: "ALL_NEW",
//         };

//         console.log("Update params:", params);

//         const result = await db.update(params).promise();
//         console.log("Note updated successfully:", result.Attributes);

//         return result.Attributes; // Return the updated note
//     } catch (error) {
//         if (error.name === "ConditionalCheckFailedException") {
//             console.error("Unauthorized access attempt:", { noteId, userId, error: error.message });
//             return { error: "Unauthorized" }; // User doesn't own the note
//         }

//         console.error("Error updating note:", { noteId, userId, error: error.message });
//         throw new Error("Internal Server Error");
//     }
// }

// // Main handler logic
// const baseHandler = async (event) => {
//     console.log("Event received:", JSON.stringify(event));

//     // Extract note ID from pathParameters
//     const noteId = event.pathParameters?.id; // Safely access the path parameter
//     if (!noteId) {
//         console.error("Note ID is missing in the request.");
//         return sendResponse(400, { success: false, message: "Note ID is required." });
//     }
//     console.log("Note ID extracted:", noteId);

//     // Extract user info from JWT token (via middleware)
//     const { id: userId } = event.user || {}; // Handle missing user object gracefully
//     if (!userId) {
//         console.error("Unauthorized: userId is missing from event.user");
//         return sendResponse(401, { success: false, message: "Unauthorized" });
//     }
//     console.log("User ID extracted:", userId);

//     // Extract and validate incoming data
//     let parsedBody;
//     try {
//         parsedBody = JSON.parse(event.body);
//     } catch (error) {
//         console.error("Invalid JSON body:", error.message);
//         return sendResponse(400, { success: false, message: "Invalid request body." });
//     }

//     const { title, text } = parsedBody || {};
//     console.log("Parsed body content:", { title, text });

//     if (!title || title.length > 50) {
//         console.error("Title validation failed:", { title });
//         return sendResponse(400, { success: false, message: "Title is required and must be 50 characters or less." });
//     }
//     if (!text || text.length > 300) {
//         console.error("Text validation failed:", { text });
//         return sendResponse(400, { success: false, message: "Text is required and must be 300 characters or less." });
//     }

//     const updatedFields = { title, text };

//     // Update the note in DynamoDB
//     const updatedNote = await updateNoteInDB(noteId, userId, updatedFields);

//     if (updatedNote.error === "Unauthorized") {
//         console.error("Unauthorized access to note:", { noteId, userId });
//         return sendResponse(403, { success: false, message: "Unauthorized access." });
//     }

//     console.log("Updated note:", updatedNote);

//     // Return the updated note
//     return sendResponse(200, { success: true, note: updatedNote });
// };

// // Wrap the handler with Middy and middleware
// const handler = middy(baseHandler)
//     .use(validateToken) // Validate token as middleware
//     .onError((error) => {
//         console.error("Unhandled error:", { message: error.message, stack: error.stack });
//         return sendResponse(500, { success: false, message: "Internal Server Error" });
//     });

// module.exports = { handler };
const middy = require("@middy/core");
const AWS = require("aws-sdk");
const { sendResponse } = require("../../responses");
const { validateToken } = require("../../middleware/auth");

const db = new AWS.DynamoDB.DocumentClient();

// Helper to fetch note from DynamoDB
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

// Function to update the note in DynamoDB
async function updateNoteInDB(noteId, userId, updatedFields) {
    try {
        const params = {
            TableName: "notes",
            Key: { id: noteId },
            UpdateExpression: "set title = :title, #text = :text, modifiedAt = :modifiedAt", // Use #text for aliasing
            ConditionExpression: "userId = :userId", // Ensure the note belongs to the user
            ExpressionAttributeValues: {
                ":title": updatedFields.title,
                ":text": updatedFields.text,
                ":modifiedAt": new Date().toISOString(),
                ":userId": userId,
            },
            ExpressionAttributeNames: {
                "#text": "text", // Alias the reserved keyword "text"
            },
            ReturnValues: "ALL_NEW",
        };

        const result = await db.update(params).promise();
        return result.Attributes; // Return the updated note
    } catch (error) {
        if (error.name === "ConditionalCheckFailedException") {
            console.error("Unauthorized access attempt:", { noteId, userId });
            return { error: "Unauthorized" }; // User doesn't own the note
        }
        console.error("Unexpected error while updating note:", { error });
        throw new Error("Internal Server Error");
    }
}


// Main handler logic
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

// Wrap the handler with Middy and middleware
const handler = middy(baseHandler)
    .use(validateToken)
    .onError((error) => {
        console.error("Unhandled error:", error.message || error);
        return sendResponse(500, { success: false, message: "Internal Server Error" });
    });

module.exports = { handler };
