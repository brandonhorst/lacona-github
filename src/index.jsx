/** @jsx createElement */
import _ from 'lodash'
import { createElement } from 'elliptical'
// import { showNotification } from 'lacona-api'
import { URL } from 'lacona-phrases'
import { onActivate } from 'lacona-source-helpers'
import { join } from 'path'
import parseLinkHeader from 'parse-link-header'
import fetch from 'node-fetch'

const API_URL = 'https://api.github.com'
const FETCH_REPOS_URL = '/user/repos'
const STANDARD_QS = '?per_page=100'
const GITHUB_IMG = join(__dirname, '../img/GitHub Filled-50.png')

async function fetchAllPages (accessToken, url, mapResults) {
  const results = []

  let page = 1
  let nextURL = url

  while (nextURL) {
    const res = await fetch(nextURL, {headers: {Authorization: `token ${accessToken}`}})
    if (!res.ok) {
      console.log('ERROR ROIERJ')
      throw new Error(`${nextURL} call returned status ${res.status} : ${res.statusText}`)
    }
    const linkHeader = parseLinkHeader(res.headers.get('Link'))
    nextURL = linkHeader.next ? linkHeader.next.url : null
    const body = await res.json()

    const newResults = _.map(body, mapResults)

    results.push(...newResults)
  }

  return results
}

async function fetchGithubRepos ({props}) {
  if (props.accessToken) {
    const results = await fetchAllPages(props.accessToken, `${API_URL}${FETCH_REPOS_URL}${STANDARD_QS}`, repo => ({
      name: repo.full_name,
      url: repo.html_url,
      id: repo.id
    }))

    return results
  }
  return []
}

const RepoSource = onActivate(fetchGithubRepos)

const RepoURL = {
  extends: [URL],
  describe ({observe, config}) {
    const accessToken = config.github.authentication
      ? config.github.authentication.access_token
      : null

    const repos = observe(<RepoSource accessToken={accessToken} />)
    const items = _.map(repos, repo => ({
      text: repo.name,
      value: repo.url
    }))

    if (items.length) {
      return (
        <placeholder argument='github repo'>
          <list items={items} strategy='contain' annotation={{type: 'image', value: GITHUB_IMG}} limit={10} />
        </placeholder>
      )
    }
  }
}

export const extensions = [RepoURL]

export const actions = {
  githubAuth (schema) {
    return new Promise((resolve, reject) => {
      if (currentServer) {
        currentServer.close(() => {
          startServer(resolve, reject)
        })
      } else {
        startServer(resolve, reject)
      }
    })
  }
}
