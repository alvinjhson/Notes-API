
const jwt = require("jsonwebtoken");

const validateToken = {
    before: async (request) => {
        try {
            const token = request.event.headers.authorization?.replace("Bearer ", "");

            if (!token) {
                throw new Error("Token is missing or malformed");
            }

            const data = jwt.verify(token, "aabbcc"); // Replace

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
