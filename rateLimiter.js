const redis = require('redis')
const moment  = require('moment')

let redisClient 
redisClient = redis.createClient()

const MAX_ALLOWED_FOR_HOUR = 4
const TIME_INTERVAL_MINUTES = 60 //Minutes
export const rateLimiterRedis = async (req,res, next) => {
    try {
        // check if client exists
        if(!redisClient) {
            throw Error("Client doesn't exist")
        }

        //current time
        let currentTime = moment()

        //fetch current user records
        let records = await redisClient.get(req.ip)

        //No record found for this IP
        if(records === null) {
            let records = [] // [ {reqLog1}, {reqLog2} ....]
            let newRequestLog = {
                requestTimestamp: currentTime.unix(),
                requestCount : 1
            }
            records.push(newRequestLog)
            redisClient.set(req.ip, records)
            next()
        }

        let data = JSON.parse(records);
        //NOTE: unix(): nof of seconds since the EPOCH, difference gives seconds , Difference/60 gives minutes
        let filteredData = records.filter( log => (currentTime.unix() - log.requestTimeStamp)/60 < TIME_INTERVAL_MINUTES) // Difference of Unix/60 gives time in difference minutes

        let sumOFReqeusts = filteredData.reduce((sum, current) => sum + current.requestCount, 0)

        if(sumOFReqeusts > MAX_ALLOWED_FOR_HOUR) {
            res.status(429).send("Rate limit exceeded")
        } else {
            let latestRequestRecord  = data[data.length -1]
            let checkIfWithinSameBucketAsLatestRequest = currentTime.subtract(10, 'minutes') 
            // 10 minutes from current time , check if last record is, then update the same count, else create new log

            if(latestRequestRecord.requestTimeStamp > checkIfWithinSameBucketAsLatestRequest) {
                latestRequestRecord.requestCount ++
                data[data.length - 1] = latestRequestRecord;
            } else {
                let newRecord = {
                        requestTimestamp: currentTime.unix(),
                        requestCount : 1
                }
                data.push(newRecord)
            }
            await redisClient.set(req.ip, JSON.stringify(data));
            next();
        }       
    } catch (error) {
        
    }
}