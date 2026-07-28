/**
 * Regional / language-market job boards beyond the core US-centric + ATS set.
 *
 * Coverage strategy (per product request): top ~10 reputable web job boards
 * for each Claude-supported UI language. Global aggregators (Indeed, LinkedIn,
 * etc.) are tagged in the core registry; this file adds local market leaders.
 *
 * Prefer correct host patterns + isPostingUrl gates; use default extract until
 * site-specific selectors are proven.
 */
import type { Board } from '../../types/domain';
import { extractBySelectors } from '../boardsExtract';

type RegionalDef = {
  id: string;
  name: string;
  matchPatterns: readonly string[];
  /** True when URL is a job detail (not search/list). */
  isPostingUrl: (url: string) => boolean;
  languages: readonly string[];
  countries?: readonly string[];
  selectors?: readonly string[];
  notes?: string;
};

function defineRegional(def: RegionalDef): Board {
  return {
    id: def.id,
    name: def.name,
    matchPatterns: def.matchPatterns,
    isPostingUrl: def.isPostingUrl,
    languages: def.languages,
    countries: def.countries,
    notes: def.notes,
    extractPageText: def.selectors
      ? (doc = document) => extractBySelectors(doc, def.selectors!)
      : undefined,
  };
}

/** Path looks like /job/… or /jobs/{id} detail (not bare /jobs). */
function pathHasJobDetail(url: string, re: RegExp): boolean {
  try {
    return re.test(new URL(url).pathname + new URL(url).search);
  } catch {
    return re.test(url);
  }
}

/**
 * Curated regional boards. Existing core boards remain in boards.ts.
 * IDs must stay unique across CORE + REGIONAL.
 */
export const REGIONAL_BOARDS: readonly Board[] = [
  // ——— English (UK / AU / global EN beyond US core) ———
  defineRegional({
    id: 'glassdoor',
    name: 'Glassdoor',
    matchPatterns: [
      '*://*.glassdoor.com/*',
      '*://*.glassdoor.co.uk/*',
      '*://*.glassdoor.ca/*',
      '*://*.glassdoor.com.au/*',
      '*://*.glassdoor.de/*',
      '*://*.glassdoor.fr/*',
      '*://*.glassdoor.co.in/*',
    ],
    isPostingUrl: (url) =>
      /glassdoor\.[a-z.]+\/job-listing\//i.test(url) ||
      /glassdoor\.[a-z.]+\/partner\/jobListing/i.test(url) ||
      (/glassdoor\.[a-z.]+\/Job\//i.test(url) && !/\/Job\/index\.htm/i.test(url)) ||
      /glassdoor\.[a-z.]+\/.*jobListingId=/i.test(url),
    languages: ['en', 'de', 'fr', 'hi'],
    countries: ['US', 'GB', 'CA', 'AU', 'DE', 'FR', 'IN'],
    selectors: ['.JobDetails_jobDescription', '[data-test="jobDescriptionText"]', 'article', 'main'],
  }),
  defineRegional({
    id: 'careerbuilder',
    name: 'CareerBuilder',
    matchPatterns: ['*://*.careerbuilder.com/*'],
    isPostingUrl: (url) => /careerbuilder\.com\/job\//i.test(url),
    languages: ['en'],
    countries: ['US'],
  }),
  defineRegional({
    id: 'reed',
    name: 'Reed',
    matchPatterns: ['*://*.reed.co.uk/*'],
    isPostingUrl: (url) => /reed\.co\.uk\/jobs\/[^/?#]+\/\d+/i.test(url),
    languages: ['en'],
    countries: ['GB'],
    selectors: ['.description-container', '[itemprop="description"]', 'main'],
  }),
  defineRegional({
    id: 'totaljobs',
    name: 'Totaljobs',
    matchPatterns: ['*://*.totaljobs.com/*'],
    isPostingUrl: (url) => /totaljobs\.com\/job\//i.test(url),
    languages: ['en'],
    countries: ['GB'],
  }),
  defineRegional({
    id: 'seek',
    name: 'SEEK',
    matchPatterns: [
      '*://*.seek.com.au/*',
      '*://*.seek.co.nz/*',
      '*://*.jobsdb.com/*',
      '*://*.jobstreet.com/*',
      '*://*.jobstreet.com.sg/*',
      '*://*.jobstreet.com.my/*',
      '*://*.jobstreet.co.id/*',
      '*://*.jobstreet.com.ph/*',
    ],
    isPostingUrl: (url) =>
      /seek\.(?:com\.au|co\.nz)\/job\//i.test(url) ||
      /jobsdb\.com\/(?:[^/]+\/)?job\//i.test(url) ||
      /jobstreet\.(?:com(?:\.[a-z]+)?|co\.id)\/(?:[^/]+\/)?job\//i.test(url),
    languages: ['en', 'id', 'zh'],
    countries: ['AU', 'NZ', 'SG', 'MY', 'ID', 'PH', 'HK', 'TH'],
    notes: 'SEEK Group: SEEK AU/NZ, JobsDB, JobStreet.',
  }),
  defineRegional({
    id: 'adzuna',
    name: 'Adzuna',
    matchPatterns: [
      '*://*.adzuna.com/*',
      '*://*.adzuna.co.uk/*',
      '*://*.adzuna.com.au/*',
      '*://*.adzuna.de/*',
      '*://*.adzuna.fr/*',
      '*://*.adzuna.co.za/*',
      '*://*.adzuna.com.br/*',
    ],
    isPostingUrl: (url) => /adzuna\.[a-z.]+\/details\//i.test(url),
    languages: ['en', 'de', 'fr', 'pt'],
    countries: ['GB', 'AU', 'DE', 'FR', 'ZA', 'BR', 'US'],
  }),
  defineRegional({
    id: 'simplyhired',
    name: 'SimplyHired',
    matchPatterns: ['*://*.simplyhired.com/*', '*://*.simplyhired.co.uk/*'],
    isPostingUrl: (url) => /simplyhired\.[a-z.]+\/job\//i.test(url),
    languages: ['en'],
    countries: ['US', 'GB'],
  }),

  // ——— Hindi / India ———
  defineRegional({
    id: 'naukri',
    name: 'Naukri',
    matchPatterns: ['*://*.naukri.com/*'],
    isPostingUrl: (url) => /naukri\.com\/job-listings-/i.test(url) || /naukri\.com\/[^/]+-jobs-/i.test(url),
    languages: ['hi', 'en', 'bn'],
    countries: ['IN'],
    selectors: ['.jd-container', '.job-desc', '[class*="styles_jds"]', 'main'],
  }),
  defineRegional({
    id: 'shine',
    name: 'Shine',
    matchPatterns: ['*://*.shine.com/*'],
    isPostingUrl: (url) => /shine\.com\/jobs\//i.test(url) && /\/j\d+/i.test(url),
    languages: ['hi', 'en'],
    countries: ['IN'],
  }),
  defineRegional({
    id: 'timesjobs',
    name: 'TimesJobs',
    matchPatterns: ['*://*.timesjobs.com/*'],
    isPostingUrl: (url) => /timesjobs\.com\/job[_-]?detail/i.test(url),
    languages: ['hi', 'en'],
    countries: ['IN'],
  }),
  defineRegional({
    id: 'foundit',
    name: 'foundit (Monster India)',
    matchPatterns: ['*://*.foundit.in/*', '*://*.monsterindia.com/*'],
    isPostingUrl: (url) =>
      /foundit\.in\/job\//i.test(url) || /monsterindia\.com\/.*job[_-]?id/i.test(url),
    languages: ['hi', 'en'],
    countries: ['IN'],
  }),
  defineRegional({
    id: 'internshala',
    name: 'Internshala',
    matchPatterns: ['*://*.internshala.com/*'],
    isPostingUrl: (url) =>
      /internshala\.com\/internship\/detail\//i.test(url) ||
      /internshala\.com\/job\/detail\//i.test(url),
    languages: ['hi', 'en'],
    countries: ['IN'],
  }),
  defineRegional({
    id: 'iimjobs',
    name: 'IIMJobs / Hirist',
    matchPatterns: ['*://*.iimjobs.com/*', '*://*.hirist.com/*', '*://*.hirist.tech/*'],
    isPostingUrl: (url) =>
      /iimjobs\.com\/j\//i.test(url) || /hirist\.(?:com|tech)\/[^/]+\/j\//i.test(url),
    languages: ['hi', 'en'],
    countries: ['IN'],
  }),

  // ——— Bengali / Bangladesh ———
  defineRegional({
    id: 'bdjobs',
    name: 'Bdjobs',
    matchPatterns: ['*://*.bdjobs.com/*'],
    isPostingUrl: (url) => /bdjobs\.com\/[^/]*job[_-]?details/i.test(url),
    languages: ['bn', 'en'],
    countries: ['BD'],
  }),

  // ——— Chinese ———
  defineRegional({
    id: 'zhaopin',
    name: 'Zhaopin (智联招聘)',
    matchPatterns: ['*://*.zhaopin.com/*'],
    isPostingUrl: (url) => /zhaopin\.com\/jobdetail\//i.test(url) || /zhaopin\.com\/jobs\/\d+/i.test(url),
    languages: ['zh'],
    countries: ['CN'],
  }),
  defineRegional({
    id: '51job',
    name: '51Job (前程无忧)',
    matchPatterns: ['*://*.51job.com/*'],
    isPostingUrl: (url) => /51job\.com\/.*\/jobs\/.*\.html/i.test(url) || /jobs\.51job\.com\/all\/\d+/i.test(url),
    languages: ['zh'],
    countries: ['CN'],
  }),
  defineRegional({
    id: 'liepin',
    name: 'Liepin (猎聘)',
    matchPatterns: ['*://*.liepin.com/*'],
    isPostingUrl: (url) => /liepin\.com\/job\//i.test(url),
    languages: ['zh'],
    countries: ['CN'],
  }),
  defineRegional({
    id: 'bosszhipin',
    name: 'BOSS Zhipin (BOSS直聘)',
    matchPatterns: ['*://*.zhipin.com/*'],
    isPostingUrl: (url) => /zhipin\.com\/job_detail\//i.test(url),
    languages: ['zh'],
    countries: ['CN'],
  }),
  defineRegional({
    id: 'lagou',
    name: 'Lagou (拉勾)',
    matchPatterns: ['*://*.lagou.com/*'],
    isPostingUrl: (url) => /lagou\.com\/jobs\/\d+/i.test(url),
    languages: ['zh'],
    countries: ['CN'],
  }),
  defineRegional({
    id: 'maimai',
    name: 'Maimai (脉脉)',
    matchPatterns: ['*://*.maimai.cn/*'],
    isPostingUrl: (url) => /maimai\.cn\/job\//i.test(url) || /maimai\.cn\/.*job[_-]?detail/i.test(url),
    languages: ['zh'],
    countries: ['CN'],
  }),

  // ——— Portuguese / Brazil ———
  defineRegional({
    id: 'catho',
    name: 'Catho',
    matchPatterns: ['*://*.catho.com.br/*'],
    isPostingUrl: (url) => /catho\.com\.br\/vagas\//i.test(url) && !/catho\.com\.br\/vagas\/?$/i.test(url),
    languages: ['pt'],
    countries: ['BR'],
  }),
  defineRegional({
    id: 'infojobs_br',
    name: 'InfoJobs Brasil',
    matchPatterns: ['*://*.infojobs.com.br/*'],
    isPostingUrl: (url) => /infojobs\.com\.br\/.*\/vaga/i.test(url) || /infojobs\.com\.br\/vaga\//i.test(url),
    languages: ['pt'],
    countries: ['BR'],
  }),
  defineRegional({
    id: 'gupy',
    name: 'Gupy',
    matchPatterns: ['*://*.gupy.io/*'],
    isPostingUrl: (url) => /gupy\.io\/(?:job\/|[^/]+\/job\/)/i.test(url),
    languages: ['pt'],
    countries: ['BR'],
  }),
  defineRegional({
    id: 'vagas_com_br',
    name: 'Vagas.com',
    matchPatterns: ['*://*.vagas.com.br/*'],
    isPostingUrl: (url) => /vagas\.com\.br\/vaga\//i.test(url),
    languages: ['pt'],
    countries: ['BR'],
  }),
  defineRegional({
    id: 'bne',
    name: 'BNE (Banco Nacional de Empregos)',
    matchPatterns: ['*://*.bne.com.br/*'],
    isPostingUrl: (url) => /bne\.com\.br\/vaga\//i.test(url),
    languages: ['pt'],
    countries: ['BR'],
  }),

  // ——— Spanish / LatAm + Spain ———
  defineRegional({
    id: 'computrabajo',
    name: 'Computrabajo',
    matchPatterns: [
      '*://*.computrabajo.com/*',
      '*://*.computrabajo.com.mx/*',
      '*://*.computrabajo.com.co/*',
      '*://*.computrabajo.com.ar/*',
      '*://*.computrabajo.com.pe/*',
      '*://*.computrabajo.es/*',
    ],
    isPostingUrl: (url) => /computrabajo\.[a-z.]+\/.*ofertas-de-trabajo\//i.test(url),
    languages: ['es'],
    countries: ['MX', 'CO', 'AR', 'PE', 'ES', 'CL'],
  }),
  defineRegional({
    id: 'occ',
    name: 'OCC Mundial',
    matchPatterns: ['*://*.occ.com.mx/*'],
    isPostingUrl: (url) => /occ\.com\.mx\/empleo\//i.test(url) || /occ\.com\.mx\/se-busca\//i.test(url),
    languages: ['es'],
    countries: ['MX'],
  }),
  defineRegional({
    id: 'bumeran',
    name: 'Bumeran',
    matchPatterns: [
      '*://*.bumeran.com.mx/*',
      '*://*.bumeran.com.ar/*',
      '*://*.bumeran.com.pe/*',
      '*://*.bumeran.com.ve/*',
    ],
    isPostingUrl: (url) => /bumeran\.com\.[a-z]+\/empleos\//i.test(url),
    languages: ['es'],
    countries: ['MX', 'AR', 'PE', 'VE'],
  }),
  defineRegional({
    id: 'infojobs_es',
    name: 'InfoJobs España',
    matchPatterns: ['*://*.infojobs.net/*'],
    isPostingUrl: (url) => /infojobs\.net\/.*\/of-i/i.test(url) || /infojobs\.net\/job\//i.test(url),
    languages: ['es', 'it'],
    countries: ['ES', 'IT'],
  }),
  defineRegional({
    id: 'elempleo',
    name: 'elempleo',
    matchPatterns: ['*://*.elempleo.com/*'],
    isPostingUrl: (url) => /elempleo\.com\/.*\/ofertas-empleo\//i.test(url),
    languages: ['es'],
    countries: ['CO'],
  }),
  defineRegional({
    id: 'zonajobs',
    name: 'ZonaJobs',
    matchPatterns: ['*://*.zonajobs.com.ar/*'],
    isPostingUrl: (url) => /zonajobs\.com\.ar\/(?:.*\/)?ofertas\//i.test(url),
    languages: ['es'],
    countries: ['AR'],
  }),

  // ——— German ———
  defineRegional({
    id: 'stepstone',
    name: 'StepStone',
    matchPatterns: [
      '*://*.stepstone.de/*',
      '*://*.stepstone.at/*',
      '*://*.stepstone.be/*',
      '*://*.stepstone.nl/*',
    ],
    isPostingUrl: (url) => /stepstone\.[a-z]+\/.*(stellenangebote|--)\d+/i.test(url),
    languages: ['de', 'nl', 'fr'],
    countries: ['DE', 'AT', 'BE', 'NL'],
  }),
  defineRegional({
    id: 'xing',
    name: 'XING Jobs',
    matchPatterns: ['*://*.xing.com/*'],
    isPostingUrl: (url) => /xing\.com\/jobs\//i.test(url) && !/xing\.com\/jobs\/?(\?|$)/i.test(url),
    languages: ['de'],
    countries: ['DE', 'AT', 'CH'],
  }),
  defineRegional({
    id: 'arbeitsagentur',
    name: 'Bundesagentur für Arbeit',
    matchPatterns: ['*://*.arbeitsagentur.de/*'],
    isPostingUrl: (url) =>
      /arbeitsagentur\.de\/jobsuche\/jobdetail\//i.test(url) ||
      pathHasJobDetail(url, /\/jobdetail\//i),
    languages: ['de'],
    countries: ['DE'],
  }),
  defineRegional({
    id: 'kununu',
    name: 'Kununu',
    matchPatterns: ['*://*.kununu.com/*'],
    isPostingUrl: (url) => /kununu\.com\/.*\/job\//i.test(url),
    languages: ['de'],
    countries: ['DE', 'AT'],
  }),
  defineRegional({
    id: 'meinestadt',
    name: 'meinestadt.de Jobs',
    matchPatterns: ['*://*.meinestadt.de/*'],
    isPostingUrl: (url) => /meinestadt\.de\/.*\/jobs\//i.test(url) && /\/\d+/i.test(url),
    languages: ['de'],
    countries: ['DE'],
  }),

  // ——— French ———
  defineRegional({
    id: 'francetravail',
    name: 'France Travail',
    matchPatterns: ['*://*.francetravail.fr/*', '*://*.pole-emploi.fr/*'],
    isPostingUrl: (url) =>
      /francetravail\.fr\/.*\/(?:offre|detail)/i.test(url) ||
      /pole-emploi\.fr\/.*\/(?:offre|detail)/i.test(url),
    languages: ['fr'],
    countries: ['FR'],
  }),
  defineRegional({
    id: 'apec',
    name: 'APEC',
    matchPatterns: ['*://*.apec.fr/*'],
    isPostingUrl: (url) => /apec\.fr\/.*\/detail-offre/i.test(url) || /apec\.fr\/offre\//i.test(url),
    languages: ['fr'],
    countries: ['FR'],
  }),
  defineRegional({
    id: 'hellowork',
    name: 'HelloWork',
    matchPatterns: ['*://*.hellowork.com/*', '*://*.regionsjob.com/*'],
    isPostingUrl: (url) => /hellowork\.com\/.*\/emplois\//i.test(url) || /regionsjob\.com\/.*\/emplois\//i.test(url),
    languages: ['fr'],
    countries: ['FR'],
  }),
  defineRegional({
    id: 'optioncarriere',
    name: 'Option Carrière',
    matchPatterns: ['*://*.optioncarriere.com/*', '*://*.optioncarriere.be/*', '*://*.optioncarriere.ca/*'],
    isPostingUrl: (url) => /optioncarriere\.[a-z]+\/job\//i.test(url),
    languages: ['fr'],
    countries: ['FR', 'BE', 'CA'],
  }),
  defineRegional({
    id: 'jobteaser',
    name: 'JobTeaser',
    matchPatterns: ['*://*.jobteaser.com/*'],
    isPostingUrl: (url) => /jobteaser\.com\/.*\/job-offers\//i.test(url),
    languages: ['fr', 'en', 'de', 'it', 'es'],
    countries: ['FR', 'DE', 'ES', 'IT', 'GB'],
  }),

  // ——— Italian ———
  defineRegional({
    id: 'infojobs_it',
    name: 'InfoJobs Italia',
    matchPatterns: ['*://*.infojobs.it/*'],
    isPostingUrl: (url) => /infojobs\.it\/.*\/of-i/i.test(url) || /infojobs\.it\/job\//i.test(url),
    languages: ['it'],
    countries: ['IT'],
  }),
  defineRegional({
    id: 'subito_lavoro',
    name: 'Subito Lavoro',
    matchPatterns: ['*://*.subito.it/*'],
    isPostingUrl: (url) => /subito\.it\/.*\/lavoro\//i.test(url),
    languages: ['it'],
    countries: ['IT'],
  }),
  defineRegional({
    id: 'corriere_lavoro',
    name: 'Corriere Lavoro',
    matchPatterns: ['*://*.corriere.it/*'],
    isPostingUrl: (url) => /corriere\.it\/lavoro\/.*\/job\//i.test(url) || /jobsites\.corriere\.it\/.*\/job\//i.test(url),
    languages: ['it'],
    countries: ['IT'],
  }),
  defineRegional({
    id: 'jobrapido',
    name: 'Jobrapido',
    matchPatterns: ['*://*.jobrapido.com/*'],
    isPostingUrl: (url) => /jobrapido\.com\/(?:[^/]+\/)?Job\//i.test(url),
    languages: ['it', 'en', 'es', 'pt', 'fr', 'de'],
    countries: ['IT', 'ES', 'BR', 'FR', 'DE', 'GB'],
  }),

  // ——— Indonesian ———
  defineRegional({
    id: 'kalibrr',
    name: 'Kalibrr',
    matchPatterns: ['*://*.kalibrr.com/*', '*://*.kalibrr.id/*'],
    isPostingUrl: (url) => /kalibrr\.(?:com|id)\/c\/[^/]+\/jobs\/\d+/i.test(url),
    languages: ['id', 'en'],
    countries: ['ID', 'PH'],
  }),
  defineRegional({
    id: 'glints',
    name: 'Glints',
    matchPatterns: ['*://*.glints.com/*'],
    isPostingUrl: (url) => /glints\.com\/.*\/opportunities\/jobs\//i.test(url),
    languages: ['id', 'en', 'zh'],
    countries: ['ID', 'SG', 'VN', 'TW'],
  }),
  defineRegional({
    id: 'karir',
    name: 'Karir.com',
    matchPatterns: ['*://*.karir.com/*'],
    isPostingUrl: (url) => /karir\.com\/opportunities\//i.test(url),
    languages: ['id'],
    countries: ['ID'],
  }),

  // ——— Japanese ———
  defineRegional({
    id: 'doda',
    name: 'Doda',
    matchPatterns: ['*://*.doda.jp/*'],
    isPostingUrl: (url) => /doda\.jp\/.*\/j_\d+/i.test(url) || /doda\.jp\/DodaFront\/View\/JobSearchDetail/i.test(url),
    languages: ['ja'],
    countries: ['JP'],
  }),
  defineRegional({
    id: 'rikunabi',
    name: 'Rikunabi NEXT',
    matchPatterns: ['*://*.rikunabi.com/*', '*://*.next.rikunabi.com/*'],
    isPostingUrl: (url) => /rikunabi\.com\/.*\/job[_-]?view/i.test(url) || /next\.rikunabi\.com\/job/i.test(url),
    languages: ['ja'],
    countries: ['JP'],
  }),
  defineRegional({
    id: 'mynavi',
    name: 'MyNavi Tenshoku',
    matchPatterns: ['*://*.mynavi.jp/*'],
    isPostingUrl: (url) => /mynavi\.jp\/jobinfo-\d+/i.test(url) || /tenshoku\.mynavi\.jp\/jobinfo/i.test(url),
    languages: ['ja'],
    countries: ['JP'],
  }),
  defineRegional({
    id: 'daijob',
    name: 'Daijob',
    matchPatterns: ['*://*.daijob.com/*'],
    isPostingUrl: (url) => /daijob\.com\/jobs\/\d+/i.test(url),
    languages: ['ja', 'en'],
    countries: ['JP'],
  }),
  defineRegional({
    id: 'wantedly',
    name: 'Wantedly',
    matchPatterns: ['*://*.wantedly.com/*'],
    isPostingUrl: (url) => /wantedly\.com\/projects\/\d+/i.test(url),
    languages: ['ja', 'en'],
    countries: ['JP', 'SG'],
  }),
  defineRegional({
    id: 'green_japan',
    name: 'Green',
    matchPatterns: ['*://*.green-japan.com/*'],
    isPostingUrl: (url) => /green-japan\.com\/company\/\d+\/job\/\d+/i.test(url),
    languages: ['ja'],
    countries: ['JP'],
  }),

  // ——— Korean ———
  defineRegional({
    id: 'saramin',
    name: 'Saramin',
    matchPatterns: ['*://*.saramin.co.kr/*'],
    isPostingUrl: (url) => /saramin\.co\.kr\/zf_user\/jobs\/relay\/view/i.test(url) || /saramin\.co\.kr\/.*view\?.*rec_idx=/i.test(url),
    languages: ['ko'],
    countries: ['KR'],
  }),
  defineRegional({
    id: 'jobkorea',
    name: 'JobKorea',
    matchPatterns: ['*://*.jobkorea.co.kr/*'],
    isPostingUrl: (url) => /jobkorea\.co\.kr\/Recruit\/GI_Read\//i.test(url) || /jobkorea\.co\.kr\/Recruit\/.*\d+/i.test(url),
    languages: ['ko'],
    countries: ['KR'],
  }),
  defineRegional({
    id: 'wanted_kr',
    name: 'Wanted',
    matchPatterns: ['*://*.wanted.co.kr/*'],
    isPostingUrl: (url) => /wanted\.co\.kr\/wd\/\d+/i.test(url),
    languages: ['ko', 'en'],
    countries: ['KR'],
  }),
  defineRegional({
    id: 'remember',
    name: 'Remember Careers',
    matchPatterns: ['*://*.rememberapp.co.kr/*', '*://career.rememberapp.co.kr/*'],
    isPostingUrl: (url) => /rememberapp\.co\.kr\/(?:.*\/)?job\//i.test(url),
    languages: ['ko'],
    countries: ['KR'],
  }),

  // ——— Arabic ———
  defineRegional({
    id: 'bayt',
    name: 'Bayt',
    matchPatterns: ['*://*.bayt.com/*'],
    isPostingUrl: (url) => /bayt\.com\/.*\/jobs\/.*-jobs\/\d+/i.test(url) || /bayt\.com\/job\//i.test(url),
    languages: ['ar', 'en'],
    countries: ['AE', 'SA', 'EG', 'QA', 'KW'],
  }),
  defineRegional({
    id: 'wuzzuf',
    name: 'Wuzzuf',
    matchPatterns: ['*://*.wuzzuf.net/*'],
    isPostingUrl: (url) => /wuzzuf\.net\/jobs\/p\//i.test(url),
    languages: ['ar', 'en'],
    countries: ['EG'],
  }),
  defineRegional({
    id: 'forasna',
    name: 'Forasna',
    matchPatterns: ['*://*.forasna.com/*'],
    isPostingUrl: (url) => /forasna\.com\/job\//i.test(url),
    languages: ['ar', 'en'],
    countries: ['EG'],
  }),
  defineRegional({
    id: 'akhtaboot',
    name: 'Akhtaboot',
    matchPatterns: ['*://*.akhtaboot.com/*'],
    isPostingUrl: (url) => /akhtaboot\.com\/.*\/jobs\//i.test(url) && /\/\d+/i.test(url),
    languages: ['ar', 'en'],
    countries: ['JO', 'AE', 'SA'],
  }),
  defineRegional({
    id: 'drjobs',
    name: 'Drjobs',
    matchPatterns: ['*://*.drjobs.ae/*', '*://*.drjobpro.com/*'],
    isPostingUrl: (url) => /drjobs\.ae\/.*job/i.test(url) || /drjobpro\.com\/.*job/i.test(url),
    languages: ['ar', 'en'],
    countries: ['AE', 'SA', 'IN'],
  }),

  // ——— Swahili / East Africa ———
  defineRegional({
    id: 'brightermonday',
    name: 'BrighterMonday',
    matchPatterns: [
      '*://*.brightermonday.co.ke/*',
      '*://*.brightermonday.co.ug/*',
      '*://*.brightermonday.co.tz/*',
    ],
    isPostingUrl: (url) => /brightermonday\.co\.[a-z]+\/jobs\//i.test(url) && !/\/jobs\/?(\?|$)/i.test(url),
    languages: ['sw', 'en'],
    countries: ['KE', 'UG', 'TZ'],
  }),
  defineRegional({
    id: 'fuzu',
    name: 'Fuzu',
    matchPatterns: ['*://*.fuzu.com/*'],
    isPostingUrl: (url) => /fuzu\.com\/kenya\/job\//i.test(url) || /fuzu\.com\/.*\/job\//i.test(url),
    languages: ['sw', 'en'],
    countries: ['KE', 'UG'],
  }),

  // ——— Yoruba / Nigeria (EN-primary boards that serve NG) ———
  defineRegional({
    id: 'jobberman',
    name: 'Jobberman',
    matchPatterns: ['*://*.jobberman.com/*', '*://*.jobberman.com.ng/*'],
    isPostingUrl: (url) => /jobberman\.com(?:\.ng)?\/listings\//i.test(url) || /jobberman\.com(?:\.ng)?\/jobs\//i.test(url),
    languages: ['en', 'yo'],
    countries: ['NG', 'GH'],
  }),
  defineRegional({
    id: 'myjobmag',
    name: 'MyJobMag',
    matchPatterns: ['*://*.myjobmag.com/*'],
    isPostingUrl: (url) => /myjobmag\.com\/job\//i.test(url),
    languages: ['en', 'yo'],
    countries: ['NG'],
  }),
  defineRegional({
    id: 'hotnigerianjobs',
    name: 'Hot Nigerian Jobs',
    matchPatterns: ['*://*.hotnigerianjobs.com/*'],
    isPostingUrl: (url) => /hotnigerianjobs\.com\/.*-job/i.test(url),
    languages: ['en', 'yo'],
    countries: ['NG'],
  }),

  // ——— Fillers for thinner language markets (still reputable locals) ———
  defineRegional({
    id: 'gulftalent',
    name: 'GulfTalent',
    matchPatterns: ['*://*.gulftalent.com/*'],
    isPostingUrl: (url) => /gulftalent\.com\/.+\/jobs\/.+/i.test(url),
    languages: ['ar', 'en'],
    countries: ['AE', 'SA', 'QA', 'BH', 'OM', 'KW'],
  }),
  defineRegional({
    id: 'tanqeeb',
    name: 'Tanqeeb',
    matchPatterns: ['*://*.tanqeeb.com/*'],
    isPostingUrl: (url) => /tanqeeb\.com\/.*\/jobs\//i.test(url),
    languages: ['ar', 'en'],
    countries: ['SA', 'AE', 'EG'],
  }),
  defineRegional({
    id: 'jobplanet_kr',
    name: 'JobPlanet',
    matchPatterns: ['*://*.jobplanet.co.kr/*'],
    isPostingUrl: (url) => /jobplanet\.co\.kr\/job\/\d+/i.test(url),
    languages: ['ko'],
    countries: ['KR'],
  }),
  defineRegional({
    id: 'incruit',
    name: 'Incruit',
    matchPatterns: ['*://*.incruit.com/*'],
    isPostingUrl: (url) => /incruit\.com\/job_detail/i.test(url) || /incruit\.com\/.*\/job\//i.test(url),
    languages: ['ko'],
    countries: ['KR'],
  }),
  defineRegional({
    id: 'jumpit',
    name: 'Jumpit',
    matchPatterns: ['*://*.jumpit.co.kr/*'],
    isPostingUrl: (url) => /jumpit\.co\.kr\/position\/\d+/i.test(url),
    languages: ['ko'],
    countries: ['KR'],
  }),
  defineRegional({
    id: 'urbanhire',
    name: 'Urbanhire',
    matchPatterns: ['*://*.urbanhire.com/*'],
    isPostingUrl: (url) => /urbanhire\.com\/job\//i.test(url),
    languages: ['id', 'en'],
    countries: ['ID'],
  }),
  defineRegional({
    id: 'jobindo',
    name: 'Jobindo',
    matchPatterns: ['*://*.jobindo.com/*'],
    isPostingUrl: (url) => /jobindo\.com\/job\//i.test(url),
    languages: ['id'],
    countries: ['ID'],
  }),
  defineRegional({
    id: 'skill_jobs_bd',
    name: 'Skill.jobs',
    matchPatterns: ['*://*.skill.jobs/*'],
    isPostingUrl: (url) => /skill\.jobs\/job\//i.test(url),
    languages: ['bn', 'en'],
    countries: ['BD'],
  }),
  defineRegional({
    id: 'chakri',
    name: 'Chakri',
    matchPatterns: ['*://*.chakri.com/*', '*://*.chakri.com.bd/*'],
    isPostingUrl: (url) => /chakri\.com(?:\.bd)?\/job\//i.test(url),
    languages: ['bn', 'en'],
    countries: ['BD'],
  }),
  defineRegional({
    id: 'careerjunction',
    name: 'CareerJunction',
    matchPatterns: ['*://*.careerjunction.co.za/*'],
    isPostingUrl: (url) => /careerjunction\.co\.za\/jobs\//i.test(url) && !/\/jobs\/?(\?|$)/i.test(url),
    languages: ['en', 'sw'],
    countries: ['ZA'],
    notes: 'Major SA board; tagged sw for southern/eastern African EN/SW jobseekers using shared portals.',
  }),
  defineRegional({
    id: 'pnet',
    name: 'PNet',
    matchPatterns: ['*://*.pnet.co.za/*'],
    isPostingUrl: (url) => /pnet\.co\.za\/jobs\//i.test(url) || /pnet\.co\.za\/job\//i.test(url),
    languages: ['en', 'sw'],
    countries: ['ZA'],
  }),
  defineRegional({
    id: 'careers24',
    name: 'Careers24',
    matchPatterns: ['*://*.careers24.com/*'],
    isPostingUrl: (url) => /careers24\.com\/jobs\/.*/i.test(url) && !/careers24\.com\/jobs\/?$/i.test(url),
    languages: ['en', 'sw'],
    countries: ['ZA'],
  }),
];
