(() => {
    const HN_API_URL_BASE = 'https://hacker-news.firebaseio.com/v0/';
    const HN_API_URL_SUFFIX = 'stories.json';
    const ALGOLIA_API_URL_BASE = 'https://hn.algolia.com/api/v1/search?tags=story';
    const ALGOLIA_API_CHUNK_SIZE = 20;
    const HN_WEB_STORY_URL_BASE = 'https://news.ycombinator.com/item?id=';

    const STORIES_COUNT = 100;

    /**
     * Get story IDs from HN API
     *
     * @param storyType One of: top, new
     */
    const getStoryIds = async (storyType) => {
        // Set up HN API URL and get top stories
        let apiUrl = `${HN_API_URL_BASE}${storyType}${HN_API_URL_SUFFIX}`;
        let response = await fetch(apiUrl);

        return response.json();
    };

    /**
     * Get story details from Algolia API
     *
     * @param ids IDs of requested stories
     */
    const getStoryDetails = async (ids) => {
        // TODO: Algolia API returns max 20 details at once
        let chunks = chunk_array(ids, ALGOLIA_API_CHUNK_SIZE);

        let details = [];
        for (let chunk of chunks) {
            // Construct ID format used in Algolia API: [1, 2, …] => story_1,story_2,…
            let storiesSelector = chunk.map(id => `story_${id}`).join(',');

            // Set up Algolia API URL and get stories details
            let apiUrl = `${ALGOLIA_API_URL_BASE},(${storiesSelector})`;
            let response = await fetch(apiUrl);
            let data = await response.json()

            details = details.concat(data.hits);
        }

        return details;
    };

    /**
     * @param storyType      One of: top, new
     * @param storiesCount   How many stories to render (0 - 500), 500 is the API limit
     * @param storiesElClass Target element class name for stories to be rendered into
     * @param countElClass   Target element class name for stories count to be rendered into
     */
    const fetchAndRenderStories = async (storyType, storiesCount, storiesElClass, countElClass) => {
        // Get story IDs
        let hnData = await getStoryIds(storyType);

        // Extract first <storiesCount> stories
        let ids = hnData.slice(0, storiesCount);

        let algoliaData = await getStoryDetails(ids);

        // Stories come sorted randomly from Algolia API
        //  - to avoid sorting array by another array (`ids` from `hnData`)
        //    let's create object with story IDs as keys and then just make 2 O(n) passes
        let storiesObj = {};
        algoliaData.forEach(({objectID, created_at, title, url}) => {
            // Extract only data we actually need
            storiesObj[objectID] = {
                id: objectID,
                // Primitive approach to get YYYY-MM-DD HH:MM:SS
                createdAt: (new Date(created_at)).toISOString().slice(0, 19).replace('T', ' '),
                title,
                urlInternal: `${HN_WEB_STORY_URL_BASE}${objectID}`,
                urlExternal: url,
            };
        });

        // Get stories array in the correct order
        let stories = ids
            // Sometimes HN API doesn't return all requested stories - filter these stories out
            .filter(id => storiesObj[id])
            .map(id => storiesObj[id]);

        // Render time!
        renderStories(stories, storiesElClass, countElClass);
    };

    /**
     * Chunk array into arrays of specified size
     *
     * @param array
     * @param size
     *
     * @returns [[]]
     */
    const chunk_array = (array, size) => {
        // Array.splice modifies array in-place!!
        let tmpArray = [].concat(array);

        let results = [];
        while (tmpArray.length) {
            results.push(tmpArray.splice(0, size));
        }
        return results;
    };

    /**
     * @param stories        Stories array: [{title: 'A', …}, {title: B, …}, …]
     * @param storiesElClass Target element class name for stories to be rendered into
     * @param countElClass   Target element class name for stories count to be rendered into
     */
    const renderStories = (stories, storiesElClass, countElClass) => {
        document.querySelector(countElClass).textContent = stories.length;
        document.querySelector(storiesElClass).innerHTML = stories
            .map((story, index) => {
                return `
                    <div class="card mt-3">
                        <div class="card-body">
                            <h6 class="card-title text-truncate">
                                <span class="badge badge-warning badge-fullsize">${index + 1}.</span>
                                <a href="${story.urlExternal}/" title="${story.title}" class="text-reset text-decoration-none" target="_blank" rel="noopener">
                                    ${story.title}
                                </a>
                            </h6>

                            <h6 class="card-text">

                                <span class="text-muted">${story.createdAt}</span>
                            </h6>

                            <a href="${story.urlExternal}/" class="card-link" target="_blank" rel="noopener">
                                <i class="fas fa-external-link-alt"></i>
                                Link
                            </a>

                            <a href="${story.urlInternal}" class="card-link" target="_blank" rel="noopener">
                                <i class="far fa-comments"></i>
                                Discussion
                            </a>
                        </div>
                    </div>
                `;
            })
            .join('\n');
    };

    fetchAndRenderStories('top', STORIES_COUNT, '.js-top-stories', '.js-top-count');
    fetchAndRenderStories('new', STORIES_COUNT, '.js-new-stories', '.js-new-count');
})();
