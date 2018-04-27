// import * as Promise from "bluebird";
import * as request from "request";

import HttpClientResponseInterface from "./../interfaces/HttpClientResponseInterface";

export default class HttpClient {

    public call(options: any): Promise<HttpClientResponseInterface> {
        return new Promise<HttpClientResponseInterface>((resolve, reject) => {
            request(options, (error, response, body) => {

                if (error) {
                    return reject(error);
                }

                if (body) {
                    try {
                        body = JSON.parse(body);
                    } catch (error) {
                        // empty
                    }
                }

                resolve({
                    body,
                    headers: response.headers,
                    status: response.statusCode,
                });
            });
        });
    }
}
