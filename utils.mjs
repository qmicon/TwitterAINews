import fetch from 'node-fetch';
import { Tiktoken } from "tiktoken/lite";
import cl100k_base from "tiktoken/encoders/cl100k_base.json"  assert { type: "json" };

export function getDateTimeFormatted(now) {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
  
    const formattedDateTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    return formattedDateTime;
  }

export async function callGetApi(url, params) {
    const queryParams = new URLSearchParams(params);
    const apiUrl = queryParams.toString() ? `${url}?${queryParams.toString()}` : url;
  
    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`Request failed with status: ${response.status}`);
      }
      const data = await response.json();
      return data;
    } catch (error) {
      throw error;
    }
  }

export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

export function calculateTokens(prompt) {
  var gpt_encoding = new Tiktoken(
    cl100k_base.bpe_ranks,
    cl100k_base.special_tokens,
    cl100k_base.pat_str
  );

var inputTokens = gpt_encoding.encode(prompt);
gpt_encoding.free();
return inputTokens.length
}

export function trimString(text, tokenLimit) {
  text = filterNonEnglish(text)
  console.log(text)
  const sentenceBoundaryRegex = /[^\.!\?]+[\.!\?]+/g;
  var sentences = text.match(sentenceBoundaryRegex);
  if(!sentences)
  sentences = [text]
  
    let trimmedStr = "";
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      if(calculateTokens(trimmedStr+sentence) > tokenLimit) 
      break;
      else
      trimmedStr+=sentence
    }
  return trimmedStr
}

export function filterNonEnglish(inputString) {
  const nonEnglishPattern = /[^A-Za-z0-9\s.,!?'"()]+/g;
  const filteredString = inputString.replace(nonEnglishPattern, '');

  return filteredString;
}
