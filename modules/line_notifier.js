async function sendNotification(message, channelAccessToken, channelSecret) {
    try {
        const response = await fetch('https://api.line.me/v2/bot/message/broadcast', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${channelAccessToken}`
            },
            body: JSON.stringify({
                messages: [{ type: 'text', text: message }]
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(`LINE API Error: ${JSON.stringify(errData)}`);
        }

        console.log("LINE notification sent.");
    } catch (error) {
        console.error('Error sending LINE notification:', error.message);
    }
}

async function replyToLine(replyToken, message, channelAccessToken) {
    try {
        const response = await fetch('https://api.line.me/v2/bot/message/reply', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${channelAccessToken}`
            },
            body: JSON.stringify({
                replyToken: replyToken,
                messages: [{ type: 'text', text: message }]
            })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(`LINE API Error: ${JSON.stringify(errData)}`);
        }

        console.log("LINE reply sent.");
    } catch (error) {
        console.error('Error replying to LINE:', error.message);
    }
}

module.exports = { sendNotification, replyToLine };
