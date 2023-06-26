let session, SNlM0e_Global;

export const init = async (sessionID) => {
    session = {
        baseURL: "https://bard.google.com",
        headers: {
            Host: "bard.google.com",
            "X-Same-Domain": "1",
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36",
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
            Origin: "https://bard.google.com",
            Referer: "https://bard.google.com/",
            Cookie: `__Secure-1PSID=${sessionID};`,
        },
    };

    const response = await fetch("https://bard.google.com/", {
        method: "GET",
        headers: session.headers,
        credentials: "include",
    });

    const data = await response.text();

    const match = data.match(/SNlM0e":"(.*?)"/);

    if (match) SNlM0e_Global = match[1];
    else throw new Error("Could not get Google Bard.");

    return SNlM0e_Global;
};

export const queryBard = async (message, ids = {}, SNlM0e = undefined) => {
    if (!SNlM0e && !SNlM0e_Global)
        throw new Error("Make sure to call Bard.init(SESSION_ID) first.");

    // Parameters and POST data
    const params = {
        bl: "boq_assistant-bard-web-server_20230613.09_p0",
        _reqID: ids._reqID ? `${ids._reqID}` : "0",
        rt: "c",
    };

    const messageStruct = [
        [message],
        null,
        ids ? Object.values(ids).slice(0, 3) : [null, null, null],
    ];

    const data = {
        "f.req": JSON.stringify([null, JSON.stringify(messageStruct)]),
        at: SNlM0e,
    };

    let url = new URL(
        "/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate",
        session.baseURL
    );

    Object.keys(params).forEach((key) =>
        url.searchParams.append(key, params[key])
    );

    let formBody = [];

    for (let property in data) {
        let encodedKey = encodeURIComponent(property);
        let encodedValue = encodeURIComponent(data[property]);
        formBody.push(encodedKey + "=" + encodedValue);
    }

    formBody = formBody.join("&");

    const response = await fetch(url.toString(), {
        method: "POST",
        headers: session.headers,
        body: formBody,
        credentials: "include",
    });

    const responseData = await response.text();

    const chatData = JSON.parse(responseData.split("\n")[3])[0][2];

    // Check if there is data
    if (!chatData) {
        throw new Error(`Google Bard encountered an error ${responseData}.`);
    }

    // Get important data, and update with important data if set to do so
    const jsonChatData = JSON.parse(chatData);

    let text = jsonChatData[0][0];

    let images = jsonChatData[4][0][4]
        ? jsonChatData[4][0][4].map((x) => {
            return {
                tag: x[2],
                url: x[0][5].match(/imgurl=([^&%]+)/)[1],
            };
        })
        : undefined;

    return {
        content: formatMarkdown(text, images),
        images: images,
        ids: {
            // Make sure kept in order, because using Object.keys() to query above
            conversationID: jsonChatData[1][0],
            responseID: jsonChatData[1][1],
            choiceID: jsonChatData[4][0][0],
            _reqID: parseInt(ids._reqID ?? 0) + 100000,
        },
    };
};

const formatMarkdown = (text, images) => {
    if (!images) return text;

    const formattedTags = new Map();

    for (let imageData of images) {
        // This can be optimized? `[...slice...]` is equal to `original`
        const formattedTag = `![${imageData.tag.slice(1, -1)}](${imageData.url
            })`;

        if (formattedTags.has(imageData.tag)) {
            const existingFormattedTag = formattedTags.get(imageData.tag);

            formattedTags.set(
                imageData.tag,
                `${existingFormattedTag}\n${formattedTag}`
            );
        } else {
            formattedTags.set(imageData.tag, formattedTag);
        }
    }

    for (let [tag, formattedTag] of formattedTags) {
        text = text.replace(tag, formattedTag);
    }

    return text;
};

export const askAI = async (message, config) => {
    let SNlM0e = undefined
    let useJSON = false

    if (typeof config == "string") {
        SNlM0e = config
    }else if (typeof config == "boolean") {
        useJSON = config
    }else {
        if ("SNlM0e" in config) {
            SNlM0e = config["SNlM0e"]
        }
        if ("useJSON" in config) {
            useJSON = config["useJSON"]
        }
    }


    if (useJSON) return await queryBard(message, {}, SNlM0e);
    else return (await queryBard(message, {}, SNlM0e)).content;
};

export class Chat {
    constructor(ids, SNlM0e = undefined) {
        this.ids = ids;
        this.SNlM0e = SNlM0e;

    }

    async ask(message, useJSON = false) {
        let request = await queryBard(message, this.ids, this.SNlM0e);
        this.ids = { ...request.ids };
        if (useJSON) return request;
        else return request.content;
    }

    export() {
        return this.ids;
    }
}

export default { init, askAI, Chat };
