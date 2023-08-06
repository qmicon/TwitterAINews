import config from './config.json'  assert { type: "json" };
import redis from 'redis';
import dotenv from 'dotenv';
import { Configuration, OpenAIApi } from 'openai';
import { TwitterApi } from 'twitter-api-v2';
import { getDateTimeFormatted, delay, callGetApi } from './utils.mjs';

dotenv.config();

const redisClient = redis.createClient({
    socket: {
        host: process.env.SERVER_IP,
        port: process.env.REDIS_PORT
    },
    password: process.env.REDIS_PASSWORD
});

redisClient.on('error', err => console.log('Redis Server Error', err));

await redisClient.connect();
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY
    });
const openai = new OpenAIApi(configuration);

const twitterClient =  new TwitterApi({ clientId: process.env.TWITTER_CLIENT_ID, clientSecret: process.env.TWITTER_CLIENT_SECRET });

async function newDayReadNewsScheduleTweets(date_str, last_task_time, nowDateTime) {
    var yesterday = new Date(nowDateTime.getTime() - 24 * 60 * 60 * 1000);
    var yesterdayDate = yesterday.toISOString().split('T')[0];
    var last_task_dt = new Date(yesterdayDate + "T" + last_task_time)
    last_task_dt.setSeconds(last_task_dt.getSeconds() + 1);
    var news_data_from_time = getDateTimeFormatted(last_task_dt)
    var news_data_to_time = getDateTimeFormatted(nowDateTime)
    var totalNewsArticles = 0
    for (let i = 0; i < config.newsSearchTexts.length; i++) {
        var searchText = config.newsSearchTexts[i]
        var params = {
            "text": searchText,
            "api-key": process.env.NEWS_API_KEY,
            "earliest-publish-date": news_data_from_time,
            "latest-publish-date": news_data_to_time,
            "language": "en",
            "max-sentiment": "0.0",
            "number": Math.floor(config.maxTweetsPerDay/config.newsSearchTexts.length)
        }
        var apiRes = null
        console.log("calling API for", searchText)
        try {
            apiRes = await callGetApi(config.newsApiUrl, params)
        }
        catch(e) {
            console.log(e)
            apiRes = await callGetApi(config.newsApiUrl, params)
        }

        console.log("API success for", searchText, "length: ", apiRes.news.length)
        
        for (let j=0; j<apiRes.news.length; j++) {
            var ANews = apiRes.news[j]
            var newsData = {
                title: ANews.title,
                text: ANews.text
            }
            var tweetIndex = totalNewsArticles + j
            console.log("Writing data for index", tweetIndex)
            await redisClient.hSet(config.redisIndexedNewsKey, `${date_str}|${tweetIndex}`, JSON.stringify(newsData))
        }
        totalNewsArticles += apiRes.news.length
        await delay(1000)
    }

    var tweetingTimeIntervalMs = Math.floor(24 * 60 * 60 * 1000/totalNewsArticles)
    for (let i = 0; i < totalNewsArticles; i++) {
        var scheduled_dt = new Date(nowDateTime.getTime() + tweetingTimeIntervalMs*i)
        var scheduled_date_time = scheduled_dt.toISOString()
        console.log("Setting Schedule time for index", i)
        await redisClient.hSet(config.redisTweetSentStatusKey, `${date_str}|${i}`, "PENDING|" + scheduled_date_time)
    }

    await redisClient.hSet(config.redisDailyTaskTrackerKey, date_str, "0|" + nowDateTime.toISOString().split('T')[1])
    return
}

async function tweetIfScheduled(date_str, tweet_index, task_create_time, nowDateTime) {
    var refreshToken = await redisClient.get(config.redisTwitterAPIRefreshToken)
    const { client: refreshedClient, accessToken, refreshToken: newRefreshToken } = await twitterClient.refreshOAuth2Token(refreshToken);
    await redisClient.set(config.redisTwitterAPIRefreshToken, newRefreshToken)
    var scheduleStatus = await redisClient.hGet(config.redisTweetSentStatusKey, `${date_str}|${tweet_index}`)
    var tweetStatusData = scheduleStatus.split('|')
    if(tweetStatusData[0] !== "PENDING")
    return
    var tweet_scheduled_dt = new Date(tweetStatusData[1])
    if(tweet_scheduled_dt >= nowDateTime)
    return
    console.log("Tweeting schedule time: ",  tweetStatusData[1])
    var newsData = await redisClient.hGet(config.redisIndexedNewsKey, `${date_str}|${tweet_index}`)
    var promptbuild = "Can you tweet an extremely opinionated tweet, which incites exnihilating emotions on this content:\n" + newsData
    promptbuild = promptbuild + "\nPlease keep the response strictly under 270 characters as that is the limit of a tweet"
    const aicompletion = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [{role: "user", content: promptbuild}],
        temperature: 0.7
      });
    console.log(aicompletion.data.usage)
    var tweet = aicompletion.data.choices[0].message.content
    tweet = "[AI] " + tweet.replace(/^\"+|\"+$/g, '');
    try{
    await refreshedClient.v2.tweet({
        text: tweet,
      })
    }
    catch(error) {
        console.log(error)
        console.log("making tweet shorter")
        var newprompt = "Can you make this tweet strictly shorter than 280 characters as that is the limit of a tweet:\n" + tweet
        const aicompletion = await openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: [{role: "user", content: newprompt}],
            temperature: 0.7
          });
        console.log(aicompletion.data.usage)
        var shorterTweet = aicompletion.data.choices[0].message.content
        shorterTweet = shorterTweet.replace(/^\"+|\"+$/g, '');
        await refreshedClient.v2.tweet({
            text: shorterTweet,
          })

    }
    console.log("tweeted:\n", tweet)
    await redisClient.hSet(config.redisTweetSentStatusKey, `${date_str}|${tweet_index}`, "DONE|"+ tweetStatusData[1])
    await redisClient.hSet(config.redisDailyTaskTrackerKey, date_str, `${parseInt(tweet_index) + 1}|${task_create_time}`)
    return
}

async function task() {
    var now = new Date()
    var nowDate = now.toISOString().split('T')[0];
    var yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    var yesterdayDate = yesterday.toISOString().split('T')[0];
    var task_date = null;
    var task_status = null;
    var task_time = null;
     if( await redisClient.hExists(config.redisDailyTaskTrackerKey, nowDate)) {
        var status = await redisClient.hGet(config.redisDailyTaskTrackerKey, nowDate)
        var data = status.split('|')
        if(data[0] === "DONE")
        return;
        else {
            task_date = nowDate
            task_status = data[0]
            task_time = data[1]
        }
     }
     else if( await redisClient.hExists(config.redisDailyTaskTrackerKey, yesterdayDate)) {
        var status = await redisClient.hGet(config.redisDailyTaskTrackerKey, yesterdayDate)
        var data = status.split('|')
        if(data[0] === "DONE") {
            task_date = nowDate
            tast_status = "CREATE"
            task_time = data[1]
        }
        else {
            task_date = yesterdayDate
            task_status = data[0]
            task_time = data[1]
        }
     }
     else {
        task_date = nowDate
        task_status = "CREATE"
        task_time = yesterday.toISOString().split('T')[1];
     }

    if( task_status === "CREATE") {
        console.log("CREATED called with", task_date, task_time, now)
        await newDayReadNewsScheduleTweets(task_date, task_time, now)
    }
    else {
        console.log("Tweeting Task start with",task_date, task_status, task_time, now)
        await tweetIfScheduled(task_date, task_status, task_time, now)
    }

}

async function repeatedCalls() {
    await task()
    setTimeout(repeatedCalls, config.sleepForMs)
}

await repeatedCalls()
