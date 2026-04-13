import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getJournalQuartile, getImpactFactorAsync } from '../helpers';

async function fetchTrialFromPubmedId(pubmedId) {
  const res = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${pubmedId}&retmode=json`);
  const data = await res.json();
  const art = data.result?.[pubmedId];
  if (!art) throw new Error('Could not fetch article details from PubMed');
  return {
    id: `pubmed-${pubmedId}`,
    pubmedId: String(pubmedId),
    title: art.title,
    status: 'Published',
    journal: art.fulljournalname,
    pubdate: art.pubdate,
    source: 'PubMed',
    keywords: [],
    mesh: [],
    quartile: getJournalQuartile(art.fulljournalname),
    impactFactor: await getImpactFactorAsync(art.fulljournalname),
  };
}

async function resolveFromURL(url) {
  url = url.trim();

  // Direct PubMed URL
  const pubmedMatch = url.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/);
  if (pubmedMatch) return pubmedMatch[1];

  // PMC URL
  const pmcMatch = url.match(/pmc\.ncbi\.nlm\.nih\.gov\/articles\/PMC(\d+)/);
  if (pmcMatch) {
    const res = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/elink.fcgi?dbfrom=pmc&db=pubmed&id=${pmcMatch[1]}&retmode=json`);
    const data = await res.json();
    const ids = data.linksets?.[0]?.linksetdbs?.[0]?.links;
    if (ids?.length) return String(ids[0]);
    throw new Error('Could not find PubMed record for this PMC article');
  }

  // Extract DOI from URL
  let doi = null;
  const doiOrgMatch = url.match(/doi\.org\/(.+)/);
  if (doiOrgMatch) doi = doiOrgMatch[1];
  const doiPathMatch = url.match(/\/(10\.\d{4,}\/[^\s?#]+)/);
  if (doiPathMatch) doi = doiPathMatch[1];

  // Try DOI search in PubMed
  if (doi) {
    doi = doi.replace(/[.,;]$/, '').split('?')[0].split('#')[0];
    const searchRes = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(doi)}[doi]&retmode=json`
    );
    const searchData = await searchRes.json();
    if (searchData.esearchresult?.idlist?.length) return searchData.esearchresult.idlist[0];
  }

  // Fetch the page and look for PMID/DOI in meta tags
  try {
    const pageRes = await fetch(url);
    const html = await pageRes.text();

    // Look for PMID in page meta tags
    const pmidMeta = html.match(/(?:citation_pmid|pmid)[^"]*"([^"]*?(\d{7,8})[^"]*?)"/i);
    if (pmidMeta) {
      const pmid = pmidMeta[0].match(/(\d{7,8})/)?.[1];
      if (pmid) return pmid;
    }

    // Look for DOI in meta tags - works for most journals
    const doiMeta = html.match(/citation_doi[^>]*content="([^"]+)"/i) ||
                    html.match(/name="dc\.identifier"[^>]*content="([^"]+doi[^"]+)"/i) ||
                    html.match(/<meta[^>]*name="DOI"[^>]*content="([^"]+)"/i);

    if (doiMeta) {
      const metaDoi = doiMeta[1].replace(/^doi:/i, '').trim();
      const metaSearch = await fetch(
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(metaDoi)}[doi]&retmode=json`
      );
      const metaData = await metaSearch.json();
      if (metaData.esearchresult?.idlist?.length) return metaData.esearchresult.idlist[0];
    }

    // Look for PII (Elsevier)
    const piiMatch = url.match(/article\/(S[\w()-]+)\//);
    if (piiMatch) {
      const piiSearch = await fetch(
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(piiMatch[1])}[pii]&retmode=json`
      );
      const piiData = await piiSearch.json();
      if (piiData.esearchresult?.idlist?.length) return piiData.esearchresult.idlist[0];
    }
  } catch {}

  throw new Error('Could not find a PubMed record for this URL. Try searching by title instead.');
}

async function resolveFromText(query) {
  // Clean up reference formatting
  const cleaned = query
    .replace(/^\d+\s*/, '')
    .replace(/\bet al\b\.?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Try to match journal reference pattern: Journal. Year;Vol:Pages
  const refMatch = query.match(/([A-Za-z\s]+)\.\s*(\d{4});(\d+)(?:\(\d+\))?:(\d+)/);
  if (refMatch) {
    const journal = refMatch[1].trim();
    const year = refMatch[2];
    const volume = refMatch[3];
    const pages = refMatch[4];
    const refQuery = `${journal}[ta] AND ${year}[dp] AND ${volume}[vi] AND ${pages}[pg]`;
    const refSearch = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(refQuery)}&retmax=5&retmode=json`
    );
    const refData = await refSearch.json();
    if (refData.esearchresult?.idlist?.length) {
      return await fetchTrialFromPubmedId(refData.esearchresult.idlist[0]);
    }
  }

  // Extract title — strip author names and journal onwards
  const titleMatch = cleaned.match(/^(.+?)\.\s*(?:Curr|N Engl|JAMA|Lancet|BMJ|Ann|Br J|J |Am J|Eur|Crit|Anesth|Pain|Int|BJA|Acta|Arch|Chest|Circ|Cochrane|Crit|Emerg|Heart|Intensive|Med|Pediatr|Resuscitation|Shock|Stroke|Thorax)/i);
  const title = titleMatch ? titleMatch[1].trim() : cleaned;

  // Search by title
  const search1 = await fetch(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(title + '[ti]')}&retmax=5&retmode=json`
  );
  const data1 = await search1.json();
  if (data1.esearchresult?.idlist?.length) {
    return await fetchTrialFromPubmedId(data1.esearchresult.idlist[0]);
  }

  // Search title/abstract
  const search2 = await fetch(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(title + '[tiab]')}&retmax=5&retmode=json`
  );
  const data2 = await search2.json();
  if (data2.esearchresult?.idlist?.length) {
    return await fetchTrialFromPubmedId(data2.esearchresult.idlist[0]);
  }

  // Key words only
  const words = title.split(' ').filter(w => w.length > 4).slice(0, 6).join(' ');
  const search3 = await fetch(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(words)}&retmax=5&retmode=json`
  );
  const data3 = await search3.json();
  if (data3.esearchresult?.idlist?.length) {
    return await fetchTrialFromPubmedId(data3.esearchresult.idlist[0]);
  }

  throw new Error('Could not find this paper on PubMed. Try pasting the PubMed URL directly.');
}

export default function AddScreen({ navigation }) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isURL = (text) => text.startsWith('http://') || text.startsWith('https://');

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      let trial;
      if (isURL(query.trim())) {
        const pubmedId = await resolveFromURL(query.trim());
        trial = await fetchTrialFromPubmedId(pubmedId);
      } else {
        trial = await resolveFromText(query.trim());
      }
      navigation.navigate('AddDetail', { trial });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

      <View style={styles.header}>
        <Text style={styles.title}>Add Paper</Text>
        <Text style={styles.subtitle}>Paste a URL, title, or reference</Text>
      </View>

      <View style={styles.inputBox}>
        <Ionicons name="search-outline" size={18} color="#aaa" style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="URL, title, or journal reference..."
          placeholderTextColor="#aaa"
          value={query}
          onChangeText={v => { setQuery(v); setError(null); }}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={handleSearch}
          multiline={false}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); setError(null); }}>
            <Ionicons name="close-circle" size={18} color="#aaa" />
          </TouchableOpacity>
        )}
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle-outline" size={16} color="#c62828" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, (!query.trim() || loading) && styles.buttonDisabled]}
        onPress={handleSearch}
        disabled={!query.trim() || loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <View style={styles.buttonInner}>
            <Ionicons name="search-outline" size={18} color="#fff" />
            <Text style={styles.buttonText}>Find Paper</Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.tipsBox}>
        <Text style={styles.tipsTitle}>You can search by</Text>
        <Text style={styles.tipText}>• Any URL — PubMed, journal website, DOI link</Text>
        <Text style={styles.tipText}>• Paper title or keywords</Text>
        <Text style={styles.tipText}>• Journal reference e.g. N Engl J Med. 2024;391:985-996</Text>
        <Text style={styles.tipText}>• Full citation e.g. Smith J et al. Title. NEJM 2024;391:985</Text>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 48, paddingBottom: 40, backgroundColor: '#f0f4f8', flexGrow: 1 },
  header: { marginBottom: 32 },
  title: { fontSize: 28, fontWeight: '800', color: '#0066CC', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#888' },
  inputBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 4,
    marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.08,
    shadowRadius: 8, elevation: 3,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 14, paddingVertical: 12, color: '#111' },
  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#ffebee', borderRadius: 10, padding: 12, marginBottom: 12,
  },
  errorText: { fontSize: 13, color: '#c62828', flex: 1 },
  button: {
    backgroundColor: '#0066CC', padding: 16, borderRadius: 14,
    alignItems: 'center', shadowColor: '#0066CC',
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  tipsBox: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    marginTop: 24, shadowColor: '#000', shadowOpacity: 0.04,
    shadowRadius: 6, elevation: 1,
  },
  tipsTitle: { fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 10 },
  tipText: { fontSize: 13, color: '#666', lineHeight: 24 },
});