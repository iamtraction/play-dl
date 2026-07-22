const { writeFileSync } = require('fs');
const UserAgent = require('user-agents');

const generator = new UserAgent({ deviceCategory: 'desktop' });
const userAgents = [];

// Keep only genuine desktop Windows/Linux user agents and exclude Internet
// Explorer. The checks run against the user-agent string itself (what servers
// see) rather than `data.platform`, which in the dataset can disagree with the
// UA string — e.g. a "Macintosh" UA reported with platform "Linux x86_64".
const isWindowsOrLinux = (ua) => ua.includes('Windows NT') || ua.includes('X11');
const isInternetExplorer = (ua) => ua.includes('MSIE') || ua.includes('Trident/');

for (let i = 0; i < 10; i++) {
	let userAgent = generator.random();

	while (
		!isWindowsOrLinux(userAgent.data.userAgent) ||
		isInternetExplorer(userAgent.data.userAgent) ||
		userAgents.includes(userAgent.toString())
	) {
		userAgent = generator.random();
	}

	userAgents.push(userAgent.toString());
}

writeFileSync('play-dl/Request/useragents.json', JSON.stringify(userAgents, null, 4));
