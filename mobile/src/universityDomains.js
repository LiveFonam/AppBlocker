const FALLBACK_REGEX = [/\.(edu|ac\.[a-z]{2,}|edu\.[a-z]{2,})$/i];
let _domainSet = null;

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
  if (_domainSet.size > 0) {
    if (_domainSet.has(domain)) return true;
    const parts = domain.split('.');
    if (parts.length > 2) {
      const parent = parts.slice(1).join('.');
      if (_domainSet.has(parent)) return true;
    }
    return false;
  }
  return FALLBACK_REGEX.some(p => p.test(domain));
}
