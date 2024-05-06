const axios = require('axios');
const cheerio = require('cheerio');

async function getUsername(url) {
  try {
    const mres = await axios.post('https://snaptik.gg/check/', { url }, { headers: { 'Content-Type': 'application/x-www-form-urlencoded'} });
    const $ = cheerio.load(mres.data.html);
    
    const username = $('.user-username').text();
    
    return username;
  } catch (error) {
    console.log("Extract error:", error);
  }
}

const getVideoInfo = async (url) => {
  try {
    const response = await axios.post('https://snaptiktok.me/wp-json/aio-dl/video-data/', { url }, { headers: { 'Content-Type': 'application/json'} });
    const username = await getUsername(url);
    return {
      poster: response.data.thumbnail, 
      url: response.data.medias[0].url,
      title: response.data.title, 
      username, 
      duration: response.data.duration
    }
  } catch (error) {
    console.log(error);
    return null;
  }
}

module.exports = { getVideoInfo };