const db = new AWS.DynamoDB.DocumentClient();
const bcrypt = require("bcryptjs");
const { sendResponse } = require("../../responses");
const jwt = require("jsonwebtoken")

const validateTOken= {
    before : async (request) => {
        try {
        const token = request.event.headers.authoriztation.replace("Bearer","")
        if (token) throw new Error();

        jwt.verify(token,"aabbcc")

        request.event.id = data.id;
        request.event.username = data.username;

        return request.response

        } catch (error) {
            request.event.error = "401";

            return request.response
        }
    }


}

module.exports = { validateToken};

// const handler = middy(getfunc)
//  .use(validateToken)