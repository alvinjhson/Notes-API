
// const jwt = require("jsonwebtoken");

// const validateToken = {
//     before : async (request) => {
//         try {
//         const token = request.event.headers.authorization.replace("Bearer","")
//         if (!token) throw new Error();

//         const data = jwt.verify(token,"aabbcc")

//         request.event.userId = data.userId;
//         request.event.username = data.username;

//         return request.response

//         } catch (error) {
//             request.event.error = "401";

//             return request.response
//         }
//     }


// }

// const jwt = require("jsonwebtoken");

// const validateToken = () => ({
//     before: async (request) => {
//         try {
//             const token = request.event.headers.authorization?.replace("Bearer", "").trim();

//             if (!token) {
//                 console.error("Token is missing or malformed");
//                 throw new Error("Unauthorized");
//             }

//             const data = jwt.verify(token, "aabbcc"); // Use your actual secret key
//             console.log("Decoded Token:", data);

//             // Attach user information to the event
//             request.event.user = {
//                 id: data.id,
//                 username: data.username,
//             };

//         } catch (error) {
//             console.error("Token validation error:", error.message);
//             throw new Error("Unauthorized");
//         }
//     },
// });

// module.exports = { validateToken };





const jwt = require("jsonwebtoken");

const validateToken = {
    before: async (request) => {
        try {
            const token = request.event.headers.authorization?.replace("Bearer ", "");

            if (!token) {
                throw new Error("Token is missing or malformed");
            }

            const data = jwt.verify(token, "aabbcc"); // Replace with your actual secret key

            // Attach the decoded user info to the event
            request.event.user = {
                id: data.id,
                username: data.username,
            };
        } catch (error) {
            console.error("Token validation error:", error.message);
            throw new Error("Unauthorized");
        }
    },
};

module.exports = { validateToken };
