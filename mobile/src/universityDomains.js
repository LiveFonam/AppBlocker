import BUNDLED_DOMAINS from './universityDomainsData';

let _domainSet = null;

function checkDomain(set, domain) {
  if (set.has(domain)) return true;
  const parts = domain.split('.');
  if (parts.length > 2) {
    const parent = parts.slice(1).join('.');
    if (set.has(parent)) return true;
  }
  return false;
}

export async function isUniversityDomain(domain) {
  if (!_domainSet) {
    try {
      const res = await fetch(
        'https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json',
        { signal: AbortSignal.timeout(8000) }
      );
      const list = await res.json();
      _domainSet = new Set(list.flatMap(u => u.domains));
    } catch (_) {
      _domainSet = new Set();
    }
  }
  if (_domainSet.size > 0) return checkDomain(_domainSet, domain);
  return checkDomain(BUNDLED_DOMAINS, domain);
}
