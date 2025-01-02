import { promisify } from './util.js'

async function sendPayloadToEndpoint(payload) {
    try {
        console.log('attempting to send payload', payload)
        const endpoint = 'https://ds1:8089/servicesNS/-/input_conf_generator_ds/receive_payload';
        console.log('Sending payload to endpoint:', endpoint);
        
        // Add proper headers including CORS and authentication
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Splunk eyJraWQiOiJzcGx1bmsuc2VjcmV0IiwiYWxnIjoiSFM1MTIiLCJ2ZXIiOiJ2MiIsInR0eXAiOiJzdGF0aWMifQ.eyJpc3MiOiJhZG1pbiBmcm9tIGRzMSIsInN1YiI6ImFkbWluIiwiYXVkIjoiZHMtc2giLCJpZHAiOiJTcGx1bmsiLCJqdGkiOiIzZmJlNjNjZjRiYjc3ZTA1ZmQ3YThlY2IyOTQ1ZmNmM2RjZmFjZjQ2YWExYjQ5ZDIwMjdkMjVmYzY1MDlhNzY0IiwiaWF0IjoxNzMyMjc3MjU4LCJleHAiOjE3MzQ4NjkyNTgsIm5iciI6MTczMjI3NzI1OH0.fqb6v5J9W3ZO09hkNXDo7KLQ-iXA6rdLfOj332wY9E95GtG7ThkVQgTLKpRz51_ctIo0g3U3JDMaSE_iTRB53A',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            body: JSON.stringify(payload),
            mode: 'cors', // Add CORS mode
            credentials: 'include' // Include credentials
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const responseData = await response.json();
        console.log('Payload sent successfully:', responseData);
        return responseData;
    } catch (error) {
        console.error('Error sending payload:', error);
        throw error;
    }
}


// You can also add retry logic if needed
async function sendPayloadWithRetry(payload, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await sendPayloadToEndpoint(payload);
        } catch (error) {
            if (attempt === maxRetries) {
                throw error;
            }
            console.log(`Attempt ${attempt} failed, retrying...`);
            // Wait for 1 second before retrying
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
}

async function perform(splunk_js_sdk, payload) {
    try {
        console.log('Received payload:', payload);

        // Send the payload
        const result = await sendPayloadToEndpoint(payload);

        // You can still keep the Splunk configuration if needed
        const application_name_space = {
            owner: "nobody",
            app: "payload_generator_app",
            sharing: "app",
        };

        // Optional: Store the request result in Splunk
        if (splunk_js_sdk) {
            const splunk_js_sdk_service = create_splunk_js_sdk_service(
                splunk_js_sdk,
                application_name_space
            );

            // Store the result or log the transaction
            await logTransaction(splunk_js_sdk_service, {
                payload: payload,
                response: result,
                timestamp: new Date().toISOString()
            });
        }

        return result;
    } catch (error) {
        console.error("Error in perform:", error);
        throw error;
    }
}

// Optional: Log the transaction in Splunk
async function logTransaction(splunk_js_sdk_service, data) {
    try {
        const index = splunk_js_sdk_service.indexes().item("main"); // or your specific index
        await promisify(index.submitEvent)(JSON.stringify(data));
    } catch (error) {
        console.error("Error logging transaction:", error);
        // Don't throw here, as this is a secondary operation
    }
}

function create_splunk_js_sdk_service(splunk_js_sdk, application_name_space) {
    const http = new splunk_js_sdk.SplunkWebHttp();
    return new splunk_js_sdk.Service(http, application_name_space);
}

// Add error handling utility
class PayloadError extends Error {
    constructor(message, statusCode, details) {
        super(message);
        this.name = 'PayloadError';
        this.statusCode = statusCode;
        this.details = details;
    }
}

// Add validation function if needed
function validatePayload(payload) {
    const requiredFields = ['message', 'severity', 'my_index', 'my_sourcetype'];
    for (const field of requiredFields) {
        if (!payload[field]) {
            throw new PayloadError(
                `Missing required field: ${field}`,
                400,
                { field, payload }
            );
        }
    }
    return true;
}

export {
    perform,
    sendPayloadToEndpoint,
    sendPayloadWithRetry,
    validatePayload,
    PayloadError
}
