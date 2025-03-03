import { Resource } from "sst";
import { task } from "sst/aws/task";

const runTask = await task.run(Resource.ScraperTask);
console.log(runTask);
