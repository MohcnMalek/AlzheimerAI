import axios from 'axios'

const client = axios.create({
  baseURL: '',  // uses Vite proxy
  timeout: 120000,  // 2 min for long tasks
})

export default client
