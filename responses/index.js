function sendResponse(code, response ) {
    return{
        statusCode: code,
        headers: {
            "content-Type": "Aplication/json"
        },
        body: JSON.stringify(response),
    };
}

module.exports = {sendResponse}