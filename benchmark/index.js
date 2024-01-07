const {
  Worker,
  isMainThread,
  parentPort,
  workerData
} = require('worker_threads')
const { withLock } = require('superlock')

const fibonacci = n => {
  if (n <= 1) return n
  return fibonacci(n - 1) + fibonacci(n - 2)
}

const runTask = async (taskId, iterations) => {
  const lock = withLock()
  const calculateFibonacci = n => lock(() => fibonacci(n))

  console.time(`Task ${taskId} Benchmark`)
  await Promise.all(
    Array.from({ length: iterations }, (_, i) => calculateFibonacci(i))
  )
  console.timeEnd(`Task ${taskId} Benchmark`)
  parentPort.postMessage('Task completed')
}

const runConcurrentTasks = async (numTasks, iterationsPerTask) => {
  const tasks = []

  for (let i = 0; i < numTasks; i++) {
    const worker = new Worker(__filename, {
      workerData: { taskId: i, iterations: iterationsPerTask }
    })

    tasks.push(
      new Promise(resolve => {
        worker.on('message', resolve)
      })
    )
  }

  await Promise.all(tasks)
}

if (isMainThread) {
  // Adjust the parameters based on your testing preferences
  const numTasks = require('os').cpus().length
  const iterationsPerTask = 40

  console.time('Mutex Benchmark')
  runConcurrentTasks(numTasks, iterationsPerTask)
    .then(() => console.timeEnd('Mutex Benchmark'))
    .catch(error => console.error('Error:', error))
} else {
  runTask(workerData.taskId, workerData.iterations)
}
