const AWS = require('aws-sdk');
const ses = new AWS.SES({ region: 'ap-northeast-1' });

exports.handler = async (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: headers,
            body: JSON.stringify({ message: 'OK' })
        };
    }

    try {
        const body = JSON.parse(event.body);
        const { to, subject, message, reservationData } = body;

        if (!to || !subject || !message) {
            return {
                statusCode: 400,
                headers: headers,
                body: JSON.stringify({
                    error: 'Missing required fields: to, subject, message'
                })
            };
        }

        const params = {
            Source: '"Loaner Laptop予約システム" <loaner-laptop-noreply@amazon.co.jp>',
            ReplyToAddresses: ['toyamrif@amazon.co.jp'],
            Destination: {
                ToAddresses: [to]
            },
            Message: {
                Subject: {
                    Data: subject,
                    Charset: 'UTF-8'
                },
                Body: {
                    Text: {
                        Data: message + '

---
※このメールは自動送信されています。
問い合わせは toyamrif@amazon.co.jp までご連絡ください。',
                        Charset: 'UTF-8'
                    }
                }
            }
        };

        const result = await ses.sendEmail(params).promise();
        console.log('Email sent successfully:', result.MessageId);

        return {
            statusCode: 200,
            headers: headers,
            body: JSON.stringify({
                message: 'Email sent successfully',
                messageId: result.MessageId,
                reservationId: reservationData?.reservationId
            })
        };

    } catch (error) {
        console.error('Error sending email:', error);

        return {
            statusCode: 500,
            headers: headers,
            body: JSON.stringify({
                error: 'Failed to send email',
                details: error.message
            })
        };
    }
};
