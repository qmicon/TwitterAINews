import fetch from 'node-fetch';
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
