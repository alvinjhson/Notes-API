function sendResponse(code, response, message = null ) {
    const responseBody = {
        ...response,
        ...(message&& {message})
    };

    return{
        statusCode: code,
        headers: {
            "content-Type": "Aplication/json"
        },
        body: JSON.stringify(responseBody),
    };
}

module.exports = {sendResponse}