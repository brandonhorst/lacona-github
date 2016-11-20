/** @jsx createElement */
import _ from 'lodash'
import { createElement } from 'elliptical'
import { showNotification } from 'lacona-api'
import { URL, Command, String } from 'lacona-phrases'
import { everyInterval } from 'lacona-source-helpers'
import { join } from 'path'
import parseLinkHeader from 'parse-link-header'
import fetch from 'node-fetch'

const API_URL = 'https://api.github.com'
const FETCH_REPOS_URL = '/user/repos'
const FETCH_ORGS_URL = '/user/orgs'
const STANDARD_QS = '?per_page=100'
const GITHUB_IMG = join(__dirname, '../icon.png')

async function fetchAllPages (accessToken, url, mapResults) {
  const results = []

  let page = 1
  let nextURL = url

  while (nextURL) {
    const res = await fetch(nextURL, {headers: {Authorization: `token ${accessToken}`}})
    if (!res.ok) {
      throw new Error(`${nextURL} call returned status ${res.status} : ${res.statusText}`)
    }
    const linkHeader = parseLinkHeader(res.headers.get('Link'))
    nextURL = (linkHeader && linkHeader.next) ? linkHeader.next.url : null
    const body = await res.json()

    const newResults = _.map(body, mapResults)

    results.push(...newResults)
  }

  return results
}

async function fetchGithubRepos ({props}) {
  if (props.accessToken) {
    try {
      const results = await fetchAllPages(props.accessToken, `${API_URL}${FETCH_REPOS_URL}${STANDARD_QS}`, repo => ({
        name: repo.full_name,
        url: repo.html_url,
        id: repo.id
      }))

      return results
    } catch (e) {
      console.error('Github Repo Fetch Error: ', e)
      return []
    }
  }
  return []
}

async function fetchGithubOrganizations ({props}) {
  if (props.accessToken) {
    try {
      const results = await fetchAllPages(props.accessToken, `${API_URL}${FETCH_ORGS_URL}${STANDARD_QS}`, org => ({
        name: org.login,
        url: `https://github.com/${encodeURIComponent(org.login)}`,
        id: org.id
      }))

      return results
    } catch (e) {
      console.error('Github Repo Fetch Error: ', e)
      return []
    }
  }
  return []
}

// Look for new repos every hour
const RepoSource = everyInterval(fetchGithubRepos, 60 * 60 * 1000, [])
const OrgSource = everyInterval(fetchGithubOrganizations, 60 * 60 * 1000, [])

const NewRepoName = {
  mapResult (result) {
    if (_.includes(result, '/')) {
      const parts = result.match(/.*\/.*/)
      return {repo: parts[1], org: parts[0]}
    } else {
      return {repo: result}
    }
  },
  describe () {
    return (
      <placeholder argument='GitHub repository'>
        <String splitOn={/\s/} filter={input => !/\s/.test(input)} />
      </placeholder>
    )
  }
}

const CreateRepoCommand = {
  extends: [Command],
  execute (result) {
    openURL({url: 'https://github.com/new'})
  },
  describe ({observe, config}) {
    // const accessToken = config.github.authentication
    //   ? config.github.authentication.access_token
    //   : null

    // const organizations = observe(<OrgSource accessToken={accessToken} />)
    // console.log(organizations)
    // const orgItems = _.map(organizations, org => ({
    //   text: org.name,
    //   value: org.name
    // }))

    // return (
    //   <sequence unique>
    //     <literal text='create ' />
    //     <list items={['repository ', 'repo ']} optional limited limit={1} />
    //     <NewRepoName merge ellipsis />
    //     {orgItems.length ? (
    //       <sequence id='org'>
    //         <literal text=' in ' />
    //         <list items={['organization ', 'org ']} optional limited limit={1} />
    //         <placeholder argument='organization' suppressEmpty={false} merge>
    //           <list items={orgItems} />
    //         </placeholder>
    //       </sequence>
    //     ) : null}
    //   </sequence>
    // )
    return <list
      items={['create new GitHub repository', 'create GitHub repository', 'create new repository', 'create repository']}
      qualifier='GitHub'
      limit={1} />
  }
}

const RepoURL = {
  extends: [URL],
  describe ({observe, config}) {
    const accessToken = config.authentication
      ? config.authentication.access_token
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

export const extensions = [RepoURL, CreateRepoCommand]
