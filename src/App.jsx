import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import {
  Search,
  Star,
  Trash2,
  LayoutGrid,
  List,
  Download,
  Clapperboard,
  X,
  Plus,
  Clock,
  Compass,
  Bookmark,
  User,
  CheckCircle2,
  Circle,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';

const TMDB_API_KEY = '3fd2be6f0c70a2a598f084ddfb75487c';
const TMDB_IMG = 'https://image.tmdb.org/t/p/w500';
const PLACEHOLDER_IMG =
  'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=500&auto=format&fit=crop&q=60';

export default function App() {
  const [activeTab, setActiveTab] = useState('library');
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [viewMode, setViewMode] = useState('grid');

  // Filtri Libreria
  const [filterType, setFilterType] = useState('title');
  const [filterValue, setFilterValue] = useState('');
  const [statusFilter, setStatusFilter] = useState('Tutti');
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  // Stack di Navigazione
  const [navHistory, setNavHistory] = useState([]);

  // Scheda Film/Serie Attiva
  const [modalItem, setModalItem] = useState(null);
  const [modalDetails, setModalDetails] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loadingItemModal, setLoadingItemModal] = useState(false);

  // Scheda Persona Attiva
  const [personModal, setPersonModal] = useState(null);
  const [personCredits, setPersonCredits] = useState([]);
  const [loadingPersonModal, setLoadingPersonModal] = useState(false);

  // Dati Esplora
  const [trendingNow, setTrendingNow] = useState([]);
  const [topRated, setTopRated] = useState([]);
  const [genreSections, setGenreSections] = useState({});
  const [recommendedForYou, setRecommendedForYou] = useState([]);
  const [loadingExplore, setLoadingExplore] = useState(false);
  const [isFixing, setIsFixing] = useState(false);

  // Sincronizzazione Firestore
  useEffect(() => {
    try {
      const unsub = onSnapshot(
        collection(db, 'watchlist'),
        (snapshot) => {
          const loaded = snapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              ...data,
              title: data.title || data.name || 'Titolo non disponibile',
              poster:
                data.poster ||
                (data.poster_path
                  ? `${TMDB_IMG}${data.poster_path}`
                  : PLACEHOLDER_IMG),
              status: data.status || 'Da vedere',
              type: data.type || 'Film',
              year: data.year || 'N/D',
            };
          });
          setItems(loaded);
        },
        () => {
          const local = localStorage.getItem('cinetrack_backup');
          if (local) setItems(JSON.parse(local));
        }
      );
      return () => unsub();
    } catch (e) {
      console.warn('Firestore error:', e);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'explore' && trendingNow.length === 0) {
      loadExploreData();
    }
  }, [activeTab]);

  useEffect(() => {
    if (items.length > 0) {
      calculateSmartRecommendations();
    }
  }, [items.length]);

  const loadExploreData = async () => {
    setLoadingExplore(true);
    try {
      const [trendRes, topRes, actionRes, scifiRes] = await Promise.all([
        fetch(
          `https://api.themoviedb.org/3/trending/all/week?api_key=${TMDB_API_KEY}&language=it-IT`
        ),
        fetch(
          `https://api.themoviedb.org/3/movie/top_rated?api_key=${TMDB_API_KEY}&language=it-IT&page=1`
        ),
        fetch(
          `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&language=it-IT&with_genres=28&sort_by=popularity.desc`
        ),
        fetch(
          `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&language=it-IT&with_genres=878&sort_by=popularity.desc`
        ),
      ]);

      const [trend, top, action, scifi] = await Promise.all([
        trendRes.json(),
        topRes.json(),
        actionRes.json(),
        scifiRes.json(),
      ]);

      setTrendingNow((trend.results || []).slice(0, 10));
      setTopRated((top.results || []).slice(0, 10));
      setGenreSections({
        'Azione & Avventura': (action.results || []).slice(0, 10),
        Fantascienza: (scifi.results || []).slice(0, 10),
      });
    } catch (e) {
      console.warn('Errore explore:', e);
    } finally {
      setLoadingExplore(false);
    }
  };

  const calculateSmartRecommendations = async () => {
    const seed = items.find((i) => i.isFavorite) || items[items.length - 1];
    if (!seed || !seed.id) return;

    try {
      const type = seed.mediaType || (seed.type === 'Film' ? 'movie' : 'tv');
      const targetId = seed.tmdbId || seed.id;
      if (!targetId || isNaN(Number(targetId))) return;

      const res = await fetch(
        `https://api.themoviedb.org/3/${type}/${targetId}/recommendations?api_key=${TMDB_API_KEY}&language=it-IT&page=1`
      );
      const data = await res.json();
      setRecommendedForYou((data.results || []).slice(0, 10));
    } catch (e) {
      console.warn('Errore raccomandazioni:', e);
    }
  };

  const fetchFullData = async (tmdbId, mediaType) => {
    if (!tmdbId || isNaN(Number(tmdbId))) return null;
    try {
      const type = mediaType === 'tv' ? 'tv' : 'movie';
      const [detailsRes, creditsRes] = await Promise.all([
        fetch(
          `https://api.themoviedb.org/3/${type}/${tmdbId}?api_key=${TMDB_API_KEY}&language=it-IT`
        ),
        fetch(
          `https://api.themoviedb.org/3/${type}/${tmdbId}/credits?api_key=${TMDB_API_KEY}&language=it-IT`
        ),
      ]);
      const d = await detailsRes.json();
      const c = await creditsRes.json();

      let directorObj = null;
      if (type === 'movie') {
        directorObj = (c.crew || []).find(
          (member) => member.job === 'Director'
        );
      } else {
        const creator = (d.created_by && d.created_by[0]) || null;
        if (creator) directorObj = { id: creator.id, name: creator.name };
      }

      const runtimeStr =
        type === 'movie'
          ? d.runtime
            ? `${d.runtime} min`
            : 'N/D'
          : `${d.number_of_seasons || 1} stagioni`;

      return {
        title: d.title || d.name || 'Titolo non disponibile',
        poster: d.poster_path ? `${TMDB_IMG}${d.poster_path}` : PLACEHOLDER_IMG,
        runtime: runtimeStr,
        director: directorObj ? directorObj.name : 'N/D',
        directorId: directorObj ? directorObj.id : null,
        cast: (c.cast || [])
          .slice(0, 12)
          .map((a) => ({ id: a.id, name: a.name, character: a.character })),
        genresList: (d.genres || []).map((g) => g.name),
        publicRating: d.vote_average ? d.vote_average.toFixed(1) : 'N/D',
        year:
          (d.release_date || d.first_air_date || '').substring(0, 4) || 'N/D',
        overview: d.overview || 'Nessuna descrizione disponibile.',
      };
    } catch {
      return null;
    }
  };

  const handleFixCorruptedItems = async () => {
    setIsFixing(true);
    const brokenItems = items.filter(
      (i) =>
        !i.title ||
        i.title === 'Titolo non disponibile' ||
        i.poster === PLACEHOLDER_IMG ||
        !i.publicRating ||
        i.publicRating === 'N/D'
    );

    for (const item of brokenItems) {
      const tmdbId = item.tmdbId || item.id;
      if (tmdbId && !isNaN(Number(tmdbId))) {
        const resolved = await fetchFullData(
          tmdbId,
          item.mediaType || (item.type === 'Film' ? 'movie' : 'tv')
        );
        if (resolved) {
          await setDoc(doc(db, 'watchlist', String(item.id)), resolved, {
            merge: true,
          });
        }
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    setIsFixing(false);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&language=it-IT&query=${encodeURIComponent(
          query
        )}&page=1`
      );
      const data = await res.json();
      const filtered = (data.results || []).filter(
        (r) => r.media_type === 'movie' || r.media_type === 'tv'
      );
      setSearchResults(filtered);
    } catch {
      alert('Errore ricerca TMDB');
    } finally {
      setIsSearching(false);
    }
  };

  const openItemDetails = async (
    rawItem,
    isFromSearch = false,
    pushToHistory = true
  ) => {
    if (pushToHistory) {
      if (modalItem) {
        setNavHistory((prev) => [
          ...prev,
          {
            type: 'item',
            item: modalItem,
            details: modalDetails,
            recs: recommendations,
          },
        ]);
      } else if (personModal) {
        setNavHistory((prev) => [
          ...prev,
          { type: 'person', person: personModal, credits: personCredits },
        ]);
      }
    }

    setPersonModal(null);
    setLoadingItemModal(true);

    const isMovie = isFromSearch
      ? rawItem.media_type === 'movie' || !rawItem.first_air_date
      : rawItem.type === 'Film' || rawItem.mediaType === 'movie';
    const mediaType = rawItem.media_type || (isMovie ? 'movie' : 'tv');
    const tmdbId = rawItem.tmdbId || rawItem.id;

    const existing = items.find((i) => String(i.id) === String(tmdbId));

    const baseInfo = existing || {
      id: String(tmdbId),
      tmdbId: tmdbId,
      title:
        (isMovie ? rawItem.title : rawItem.name) ||
        rawItem.title ||
        rawItem.name ||
        'Titolo non disponibile',
      type: isMovie ? 'Film' : 'Serie TV',
      mediaType: mediaType,
      year:
        (
          (isMovie ? rawItem.release_date : rawItem.first_air_date) || ''
        ).substring(0, 4) || 'N/D',
      overview: rawItem.overview || 'Nessuna descrizione disponibile.',
      poster: rawItem.poster_path
        ? `${TMDB_IMG}${rawItem.poster_path}`
        : rawItem.poster || PLACEHOLDER_IMG,
      publicRating: rawItem.vote_average
        ? rawItem.vote_average.toFixed(1)
        : rawItem.publicRating || 'N/D',
      userRating: 0,
      status: 'Da vedere',
      isFavorite: false,
    };

    setModalItem(baseInfo);

    const [fullData, recsRes] = await Promise.all([
      fetchFullData(tmdbId, mediaType),
      fetch(
        `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/recommendations?api_key=${TMDB_API_KEY}&language=it-IT&page=1`
      ).catch(() => null),
    ]);

    if (fullData) {
      setModalDetails(fullData);
      setModalItem((prev) => ({ ...prev, ...fullData }));
      if (existing) {
        setDoc(doc(db, 'watchlist', String(existing.id)), fullData, {
          merge: true,
        }).catch(() => {});
      }
    }

    if (recsRes) {
      const recsData = await recsRes.json();
      setRecommendations((recsData.results || []).slice(0, 8));
    } else {
      setRecommendations([]);
    }

    setLoadingItemModal(false);
  };

  const openPersonDetails = async (
    personId,
    personName,
    pushToHistory = true
  ) => {
    if (!personId) return;

    if (pushToHistory) {
      if (modalItem) {
        setNavHistory((prev) => [
          ...prev,
          {
            type: 'item',
            item: modalItem,
            details: modalDetails,
            recs: recommendations,
          },
        ]);
      } else if (personModal) {
        setNavHistory((prev) => [
          ...prev,
          { type: 'person', person: personModal, credits: personCredits },
        ]);
      }
    }

    setModalItem(null);
    setLoadingPersonModal(true);
    setPersonModal({ id: personId, name: personName });

    try {
      const [personRes, creditsRes] = await Promise.all([
        fetch(
          `https://api.themoviedb.org/3/person/${personId}?api_key=${TMDB_API_KEY}&language=it-IT`
        ),
        fetch(
          `https://api.themoviedb.org/3/person/${personId}/combined_credits?api_key=${TMDB_API_KEY}&language=it-IT`
        ),
      ]);
      const p = await personRes.json();
      const c = await creditsRes.json();

      setPersonModal({
        id: personId,
        name: p.name || personName,
        biography: p.biography || 'Nessuna biografia disponibile in italiano.',
        birthday: p.birthday || 'N/D',
        placeOfBirth: p.place_of_birth || 'N/D',
        profilePath: p.profile_path ? `${TMDB_IMG}${p.profile_path}` : null,
        knownFor: p.known_for_department || 'Cinema',
      });

      const combined = [
        ...(c.cast || []),
        ...(c.crew || []).filter((cr) => cr.job === 'Director'),
      ];
      const unique = Array.from(
        new Map(
          combined
            .filter((item) => item.poster_path)
            .map((item) => [item.id, item])
        ).values()
      ).sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0));

      setPersonCredits(unique);
    } catch {
      alert('Errore caricamento persona.');
    } finally {
      setLoadingPersonModal(false);
    }
  };

  const handleGoBack = () => {
    if (navHistory.length === 0) return;
    const lastEntry = navHistory[navHistory.length - 1];
    setNavHistory((prev) => prev.slice(0, -1));

    if (lastEntry.type === 'item') {
      setPersonModal(null);
      setModalItem(lastEntry.item);
      setModalDetails(lastEntry.details);
      setRecommendations(lastEntry.recs || []);
    } else if (lastEntry.type === 'person') {
      setModalItem(null);
      setPersonModal(lastEntry.person);
      setPersonCredits(lastEntry.credits || []);
    }
  };

  const closeAllModals = () => {
    setModalItem(null);
    setPersonModal(null);
    setNavHistory([]);
  };

  const toggleWatched = async (item) => {
    const newStatus = item.status === 'Visto' ? 'Da vedere' : 'Visto';
    await updateItem(item.id, 'status', newStatus);
  };

  const saveOrUpdateItem = async (itemToSave) => {
    const full = { ...itemToSave, ...(modalDetails || {}) };
    try {
      await setDoc(doc(db, 'watchlist', String(full.id)), full, {
        merge: true,
      });
    } catch {
      const next = [...items.filter((i) => i.id !== full.id), full];
      setItems(next);
      localStorage.setItem('cinetrack_backup', JSON.stringify(next));
    }
  };

  const toggleFavorite = async (item) => {
    const newVal = !item.isFavorite;
    try {
      await setDoc(
        doc(db, 'watchlist', String(item.id)),
        { isFavorite: newVal },
        { merge: true }
      );
    } catch {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, isFavorite: newVal } : i))
      );
    }
    if (modalItem && modalItem.id === item.id) {
      setModalItem((prev) => ({ ...prev, isFavorite: newVal }));
    }
  };

  const updateItem = async (id, field, value) => {
    try {
      await setDoc(
        doc(db, 'watchlist', String(id)),
        { [field]: value },
        { merge: true }
      );
    } catch {
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, [field]: value } : i))
      );
    }
    if (modalItem && modalItem.id === id) {
      setModalItem((prev) => ({ ...prev, [field]: value }));
    }
  };

  const removeItem = async (id) => {
    try {
      await deleteDoc(doc(db, 'watchlist', String(id)));
    } catch {
      setItems((prev) => prev.filter((i) => i.id !== id));
    }
    if (modalItem && modalItem.id === id) closeAllModals();
  };

  const exportCSV = () => {
    if (!items.length) return alert('Nessun dato da esportare.');
    const headers = [
      'Titolo',
      'Tipo',
      'Anno',
      'Durata',
      'Regista',
      'Cast',
      'Generi',
      'Preferito',
      'Stato',
      'Voto Personale',
    ];
    const rows = items.map((i) => [
      `"${i.title}"`,
      i.type,
      i.year,
      `"${i.runtime || ''}"`,
      `"${i.director || ''}"`,
      `"${(Array.isArray(i.cast)
        ? i.cast.map((c) => (typeof c === 'string' ? c : c.name))
        : []
      ).join(', ')}"`,
      `"${(i.genresList || []).join(', ')}"`,
      i.isFavorite ? 'Si' : 'No',
      `"${i.status}"`,
      i.userRating,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = 'cinetrack_libreria.csv';
    link.click();
  };

  const filteredItems = items.filter((item) => {
    const matchStatus =
      statusFilter === 'Tutti' || item.status === statusFilter;
    const matchFav = !onlyFavorites || item.isFavorite;
    if (!matchStatus || !matchFav) return false;
    if (!filterValue.trim()) return true;

    const term = filterValue.toLowerCase();
    if (filterType === 'title') return item.title?.toLowerCase().includes(term);
    if (filterType === 'actor')
      return item.cast?.some((a) =>
        (typeof a === 'string' ? a : a.name).toLowerCase().includes(term)
      );
    if (filterType === 'director')
      return item.director?.toLowerCase().includes(term);
    if (filterType === 'genre')
      return item.genresList?.some((g) => g.toLowerCase().includes(term));
    if (filterType === 'year') return item.year?.includes(term);
    return true;
  });

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0b1329',
        color: '#f8fafc',
        fontFamily: 'sans-serif',
        padding: '24px',
      }}
    >
      {/* Header */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: '1.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <Clapperboard color="#38bdf8" /> CineTrack Cloud
          </h1>
          <p
            style={{
              margin: '4px 0 0 0',
              color: '#94a3b8',
              fontSize: '0.9rem',
            }}
          >
            Catalogo Personale & Esplorazione TMDB
          </p>
        </div>

        {/* Switch Schede */}
        <div
          style={{
            display: 'flex',
            background: '#151f38',
            padding: '4px',
            borderRadius: '8px',
            border: '1px solid #1e293b',
          }}
        >
          <button
            onClick={() => setActiveTab('library')}
            style={{
              ...tabBtn,
              background: activeTab === 'library' ? '#0284c7' : 'transparent',
            }}
          >
            <Bookmark size={16} /> La Mia Libreria ({items.length})
          </button>
          <button
            onClick={() => setActiveTab('explore')}
            style={{
              ...tabBtn,
              background: activeTab === 'explore' ? '#0284c7' : 'transparent',
            }}
          >
            <Compass size={16} /> Esplora / Scopri
          </button>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {activeTab === 'library' && (
            <>
              <button
                onClick={handleFixCorruptedItems}
                disabled={isFixing}
                title="Ripristina locandine e dettagli per i film non caricati"
                style={{
                  ...btnSecondary,
                  color: isFixing ? '#94a3b8' : '#38bdf8',
                }}
              >
                <RefreshCw
                  size={16}
                  className={isFixing ? 'animate-spin' : ''}
                />{' '}
                {isFixing ? 'Ripristino...' : 'Ripristina Dati'}
              </button>
              <button
                onClick={() =>
                  setViewMode(viewMode === 'grid' ? 'table' : 'grid')
                }
                style={btnSecondary}
              >
                {viewMode === 'grid' ? (
                  <List size={18} />
                ) : (
                  <LayoutGrid size={18} />
                )}{' '}
                {viewMode === 'grid' ? 'Tabella' : 'Griglia'}
              </button>
            </>
          )}
          <button onClick={exportCSV} style={btnSecondary}>
            <Download size={18} /> Backup CSV
          </button>
        </div>
      </header>

      {/* Ricerca Universale */}
      <section style={{ marginBottom: '28px', maxWidth: '650px' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Cerca qualsiasi film o serie tv su TMDB..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={inputStyle}
          />
          <button type="submit" disabled={isSearching} style={btnPrimary}>
            <Search size={18} /> {isSearching ? 'Cercando...' : 'Cerca'}
          </button>
        </form>

        {searchResults.length > 0 && (
          <div
            style={{
              marginTop: '12px',
              background: '#151f38',
              borderRadius: '8px',
              padding: '12px',
              maxHeight: '350px',
              overflowY: 'auto',
              border: '1px solid #334155',
            }}
          >
            {searchResults.map((res) => {
              const isSaved = items.some(
                (i) => String(i.id) === String(res.id)
              );
              return (
                <div
                  key={res.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px',
                    borderBottom: '1px solid #1e293b',
                    cursor: 'pointer',
                  }}
                  onClick={() => openItemDetails(res, true)}
                >
                  <div
                    style={{
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'center',
                    }}
                  >
                    <img
                      src={
                        res.poster_path
                          ? `${TMDB_IMG}${res.poster_path}`
                          : PLACEHOLDER_IMG
                      }
                      alt=""
                      style={{
                        width: '42px',
                        height: '60px',
                        objectFit: 'cover',
                        borderRadius: '4px',
                      }}
                    />
                    <div>
                      <strong style={{ color: '#38bdf8' }}>
                        {res.title || res.name}
                      </strong>{' '}
                      (
                      {(res.release_date || res.first_air_date || '').substring(
                        0,
                        4
                      )}
                      )
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        {res.media_type === 'movie' ? 'Film' : 'Serie TV'} • ⭐{' '}
                        {res.vote_average?.toFixed(1)}
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'center',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isSaved ? (
                      <span
                        style={{
                          fontSize: '0.8rem',
                          color: '#22c55e',
                          fontWeight: 'bold',
                        }}
                      >
                        In libreria
                      </span>
                    ) : (
                      <button
                        onClick={() => openItemDetails(res, true)}
                        style={{
                          ...btnPrimary,
                          padding: '6px 12px',
                          fontSize: '0.85rem',
                        }}
                      >
                        + Aggiungi
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* --- SCHEDA 1: LA MIA LIBRERIA --- */}
      {activeTab === 'library' && (
        <>
          <div
            style={{
              display: 'flex',
              gap: '12px',
              marginBottom: '24px',
              flexWrap: 'wrap',
              alignItems: 'center',
              background: '#151f38',
              padding: '14px',
              borderRadius: '8px',
              border: '1px solid #1e293b',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                Filtra per:
              </span>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                style={selectStyle}
              >
                <option value="title">Titolo</option>
                <option value="actor">Attore</option>
                <option value="director">Regista</option>
                <option value="genre">Genere</option>
                <option value="year">Anno</option>
              </select>
              <input
                type="text"
                placeholder={`Inserisci ${filterType}...`}
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                style={{ ...inputStyle, width: '180px' }}
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={selectStyle}
            >
              <option value="Tutti">Tutti gli stati</option>
              <option value="Da vedere">Da vedere</option>
              <option value="Visto">Visto</option>
              <option value="Da rivedere">Da rivedere</option>
            </select>

            <button
              onClick={() => setOnlyFavorites(!onlyFavorites)}
              style={{
                ...btnSecondary,
                background: onlyFavorites ? '#eab308' : '#334155',
                color: onlyFavorites ? '#000' : '#fff',
                fontWeight: onlyFavorites ? 'bold' : 'normal',
              }}
            >
              <Star size={16} fill={onlyFavorites ? '#000' : 'none'} />{' '}
              Preferiti
            </button>

            <span
              style={{
                color: '#94a3b8',
                fontSize: '0.9rem',
                marginLeft: 'auto',
              }}
            >
              {filteredItems.length} salvati
            </span>
          </div>

          {viewMode === 'grid' ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '20px',
              }}
            >
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    background: '#151f38',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    border: '1px solid #1e293b',
                    position: 'relative',
                  }}
                >
                  {/* Spunta rapida Visto */}
                  <button
                    onClick={() => toggleWatched(item)}
                    style={{
                      position: 'absolute',
                      top: '10px',
                      left: '10px',
                      zIndex: 10,
                      background: 'rgba(0,0,0,0.65)',
                      border: 'none',
                      borderRadius: '50%',
                      padding: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title={
                      item.status === 'Visto'
                        ? 'Segna come Da vedere'
                        : 'Segna come Visto'
                    }
                  >
                    {item.status === 'Visto' ? (
                      <CheckCircle2 size={20} color="#22c55e" />
                    ) : (
                      <Circle size={20} color="#94a3b8" />
                    )}
                  </button>

                  {/* Stellina Preferiti */}
                  <button
                    onClick={() => toggleFavorite(item)}
                    style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      zIndex: 10,
                      background: 'rgba(0,0,0,0.65)',
                      border: 'none',
                      borderRadius: '50%',
                      padding: '6px',
                      cursor: 'pointer',
                    }}
                    title="Aggiungi ai preferiti"
                  >
                    <Star
                      size={20}
                      color="#eab308"
                      fill={item.isFavorite ? '#eab308' : 'none'}
                    />
                  </button>

                  <div
                    style={{ cursor: 'pointer' }}
                    onClick={() => openItemDetails(item)}
                  >
                    <img
                      src={item.poster || PLACEHOLDER_IMG}
                      alt={item.title}
                      style={{
                        width: '100%',
                        height: '290px',
                        objectFit: 'cover',
                      }}
                      onError={(e) => {
                        e.target.src = PLACEHOLDER_IMG;
                      }}
                    />
                  </div>

                  <div
                    style={{
                      padding: '12px',
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <h3
                      onClick={() => openItemDetails(item)}
                      style={{
                        margin: 0,
                        fontSize: '1rem',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        cursor: 'pointer',
                        color: '#38bdf8',
                      }}
                    >
                      {item.title}
                    </h3>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      {item.type} • {item.year}{' '}
                      {item.runtime ? `• ${item.runtime}` : ''}
                    </div>

                    {item.director && item.director !== 'N/D' && (
                      <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                        Regia: {item.director}
                      </div>
                    )}

                    <div
                      style={{
                        fontSize: '0.85rem',
                        color: '#f59e0b',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Star size={14} fill="#f59e0b" /> TMDB:{' '}
                      {item.publicRating || 'N/D'}
                    </div>

                    <div
                      style={{
                        marginTop: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        paddingTop: '8px',
                      }}
                    >
                      <select
                        value={item.status || 'Da vedere'}
                        onChange={(e) =>
                          updateItem(item.id, 'status', e.target.value)
                        }
                        style={{ ...selectStyle, width: '100%' }}
                      >
                        <option value="Da vedere">Da vedere</option>
                        <option value="Visto">Visto</option>
                        <option value="Da rivedere">Da rivedere</option>
                      </select>

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                          Voto:
                        </span>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          value={item.userRating || ''}
                          placeholder="0-10"
                          onChange={(e) =>
                            updateItem(item.id, 'userRating', e.target.value)
                          }
                          style={{
                            ...inputStyle,
                            width: '55px',
                            padding: '4px 8px',
                            textAlign: 'center',
                          }}
                        />
                        <button
                          onClick={() => removeItem(item.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                overflowX: 'auto',
                background: '#151f38',
                borderRadius: '8px',
              }}
            >
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  textAlign: 'left',
                  fontSize: '0.9rem',
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: '1px solid #334155',
                      color: '#94a3b8',
                    }}
                  >
                    <th style={{ padding: '12px', width: '35px' }}>Visto</th>
                    <th style={{ padding: '12px', width: '35px' }}>★</th>
                    <th>Titolo</th>
                    <th>Tipo</th>
                    <th>Anno</th>
                    <th>Durata</th>
                    <th>Regista</th>
                    <th>TMDB</th>
                    <th>Mio Voto</th>
                    <th>Stato</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr
                      key={item.id}
                      style={{ borderBottom: '1px solid #1e293b' }}
                    >
                      <td style={{ padding: '10px 12px' }}>
                        <button
                          onClick={() => toggleWatched(item)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          {item.status === 'Visto' ? (
                            <CheckCircle2 size={18} color="#22c55e" />
                          ) : (
                            <Circle size={18} color="#94a3b8" />
                          )}
                        </button>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <button
                          onClick={() => toggleFavorite(item)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          <Star
                            size={18}
                            color="#eab308"
                            fill={item.isFavorite ? '#eab308' : 'none'}
                          />
                        </button>
                      </td>
                      <td
                        style={{
                          padding: '10px 12px',
                          cursor: 'pointer',
                          color: '#38bdf8',
                        }}
                        onClick={() => openItemDetails(item)}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                          }}
                        >
                          <img
                            src={item.poster || PLACEHOLDER_IMG}
                            style={{
                              width: '30px',
                              height: '45px',
                              objectFit: 'cover',
                              borderRadius: '3px',
                            }}
                            alt=""
                            onError={(e) => {
                              e.target.src = PLACEHOLDER_IMG;
                            }}
                          />
                          <strong>{item.title}</strong>
                        </div>
                      </td>
                      <td>{item.type}</td>
                      <td>{item.year}</td>
                      <td>{item.runtime || 'N/D'}</td>
                      <td style={{ color: '#cbd5e1' }}>
                        {item.director || 'N/D'}
                      </td>
                      <td>⭐ {item.publicRating || 'N/D'}</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          value={item.userRating || ''}
                          onChange={(e) =>
                            updateItem(item.id, 'userRating', e.target.value)
                          }
                          style={{
                            ...inputStyle,
                            width: '50px',
                            padding: '4px',
                          }}
                        />
                      </td>
                      <td>
                        <select
                          value={item.status || 'Da vedere'}
                          onChange={(e) =>
                            updateItem(item.id, 'status', e.target.value)
                          }
                          style={selectStyle}
                        >
                          <option value="Da vedere">Da vedere</option>
                          <option value="Visto">Visto</option>
                          <option value="Da rivedere">Da rivedere</option>
                        </select>
                      </td>
                      <td>
                        <button
                          onClick={() => removeItem(item.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* --- SCHEDA 2: ESPLORA & SCOPRI --- */}
      {activeTab === 'explore' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {loadingExplore ? (
            <div
              style={{ color: '#94a3b8', textAlign: 'center', padding: '40px' }}
            >
              Caricamento catalogo in corso...
            </div>
          ) : (
            <>
              {recommendedForYou.length > 0 && (
                <CarouselSection
                  title="✨ Consigliati per te"
                  items={recommendedForYou}
                  onSelect={(film) => openItemDetails(film, true)}
                  savedIds={items.map((i) => String(i.id))}
                />
              )}

              <CarouselSection
                title="🔥 Nuove uscite & Tendenze della settimana"
                items={trendingNow}
                onSelect={(film) => openItemDetails(film, true)}
                savedIds={items.map((i) => String(i.id))}
              />

              <CarouselSection
                title="🍿 I più votati di sempre"
                items={topRated}
                onSelect={(film) => openItemDetails(film, true)}
                savedIds={items.map((i) => String(i.id))}
              />

              {Object.entries(genreSections).map(([genreName, movieList]) => (
                <CarouselSection
                  key={genreName}
                  title={`🎭 Classifiche: ${genreName}`}
                  items={movieList}
                  onSelect={(film) => openItemDetails(film, true)}
                  savedIds={items.map((i) => String(i.id))}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* --- MODALE 1: SCHEDA DETTAGLIO FILM / SERIE --- */}
      {modalItem && (
        <div style={modalOverlay}>
          <div style={modalCard}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              {navHistory.length > 0 ? (
                <button onClick={handleGoBack} style={backBtn}>
                  <ArrowLeft size={16} /> Indietro
                </button>
              ) : (
                <div />
              )}

              <button onClick={closeAllModals} style={closeModalBtn}>
                <X size={24} />
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                gap: '20px',
                flexWrap: 'wrap',
                marginBottom: '20px',
              }}
            >
              <img
                src={modalItem.poster || PLACEHOLDER_IMG}
                alt={modalItem.title}
                style={{
                  width: '170px',
                  height: '255px',
                  objectFit: 'cover',
                  borderRadius: '8px',
                }}
                onError={(e) => {
                  e.target.src = PLACEHOLDER_IMG;
                }}
              />

              <div style={{ flex: 1, minWidth: '260px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    flexWrap: 'wrap',
                  }}
                >
                  <h2 style={{ margin: 0, fontSize: '1.6rem' }}>
                    {modalItem.title}
                  </h2>

                  <button
                    onClick={() => toggleWatched(modalItem)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      color:
                        modalItem.status === 'Visto' ? '#22c55e' : '#94a3b8',
                    }}
                  >
                    {modalItem.status === 'Visto' ? (
                      <CheckCircle2 size={24} />
                    ) : (
                      <Circle size={24} />
                    )}
                    <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>
                      {modalItem.status === 'Visto' ? 'Visto' : 'Non visto'}
                    </span>
                  </button>

                  <button
                    onClick={() => toggleFavorite(modalItem)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <Star
                      size={24}
                      color="#eab308"
                      fill={modalItem.isFavorite ? '#eab308' : 'none'}
                    />
                  </button>
                </div>

                <div
                  style={{
                    color: '#94a3b8',
                    fontSize: '0.9rem',
                    margin: '8px 0 12px 0',
                    display: 'flex',
                    gap: '10px',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <span>{modalItem.type}</span>
                  <span>•</span>
                  <span>{modalItem.year}</span>
                  <span>•</span>
                  <span>
                    <Clock size={14} style={{ verticalAlign: 'middle' }} />{' '}
                    {modalDetails?.runtime || modalItem.runtime || 'N/D'}
                  </span>
                  <span>•</span>
                  <span>⭐ {modalItem.publicRating || 'N/D'} TMDB</span>
                </div>

                {(modalDetails?.genresList || modalItem.genresList) && (
                  <div
                    style={{
                      display: 'flex',
                      gap: '6px',
                      flexWrap: 'wrap',
                      marginBottom: '12px',
                    }}
                  >
                    {(modalDetails?.genresList || modalItem.genresList).map(
                      (g, idx) => (
                        <span
                          key={idx}
                          style={{
                            background: '#1e293b',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            color: '#38bdf8',
                          }}
                        >
                          {g}
                        </span>
                      )
                    )}
                  </div>
                )}

                <div style={{ fontSize: '0.9rem', marginBottom: '10px' }}>
                  <strong>Regia: </strong>
                  {modalDetails?.director && modalDetails.director !== 'N/D' ? (
                    <span
                      onClick={() =>
                        openPersonDetails(
                          modalDetails.directorId,
                          modalDetails.director
                        )
                      }
                      style={{
                        color: '#38bdf8',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        marginLeft: '4px',
                      }}
                    >
                      {modalDetails.director}
                    </span>
                  ) : (
                    <span style={{ color: '#cbd5e1' }}>
                      {modalItem.director || 'N/D'}
                    </span>
                  )}
                </div>

                <p
                  style={{
                    fontSize: '0.85rem',
                    lineHeight: '1.5',
                    color: '#94a3b8',
                    maxHeight: '85px',
                    overflowY: 'auto',
                  }}
                >
                  {modalItem.overview}
                </p>

                <div
                  style={{
                    marginTop: '16px',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  {items.some((i) => String(i.id) === String(modalItem.id)) ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.85rem',
                          color: '#22c55e',
                          fontWeight: 'bold',
                        }}
                      >
                        In Libreria:
                      </span>
                      <select
                        value={modalItem.status || 'Da vedere'}
                        onChange={(e) =>
                          updateItem(modalItem.id, 'status', e.target.value)
                        }
                        style={selectStyle}
                      >
                        <option value="Da vedere">Da vedere</option>
                        <option value="Visto">Visto</option>
                        <option value="Da rivedere">Da rivedere</option>
                      </select>
                    </div>
                  ) : (
                    <button
                      onClick={() => saveOrUpdateItem(modalItem)}
                      style={btnPrimary}
                    >
                      <Plus size={16} /> Aggiungi alla mia lista
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Cast */}
            <div
              style={{
                borderTop: '1px solid #1e293b',
                paddingTop: '14px',
                marginBottom: '16px',
              }}
            >
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem' }}>
                Cast Principale:
              </h4>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {(modalDetails?.cast || modalItem.cast || []).map(
                  (actor, idx) => {
                    const actorName =
                      typeof actor === 'string' ? actor : actor.name;
                    const actorId = typeof actor === 'object' ? actor.id : null;
                    return (
                      <button
                        key={idx}
                        onClick={() =>
                          actorId && openPersonDetails(actorId, actorName)
                        }
                        style={{
                          background: '#1e293b',
                          border: '1px solid #334155',
                          color: '#f8fafc',
                          padding: '5px 12px',
                          borderRadius: '16px',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <User size={13} color="#38bdf8" /> {actorName}
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {/* Simili e saga */}
            <div style={{ borderTop: '1px solid #1e293b', paddingTop: '14px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem' }}>
                Titoli Simili / Della stessa saga:
              </h4>
              {recommendations.length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                  Nessun titolo simile trovato.
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fill, minmax(105px, 1fr))',
                    gap: '10px',
                  }}
                >
                  {recommendations.map((rec) => (
                    <div
                      key={rec.id}
                      onClick={() => openItemDetails(rec, true)}
                      style={{
                        background: '#1e293b',
                        borderRadius: '6px',
                        overflow: 'hidden',
                        textAlign: 'center',
                        paddingBottom: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      <img
                        src={
                          rec.poster_path
                            ? `${TMDB_IMG}${rec.poster_path}`
                            : PLACEHOLDER_IMG
                        }
                        alt=""
                        style={{
                          width: '100%',
                          height: '145px',
                          objectFit: 'cover',
                        }}
                        onError={(e) => {
                          e.target.src = PLACEHOLDER_IMG;
                        }}
                      />
                      <div
                        style={{
                          fontSize: '0.75rem',
                          padding: '4px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {rec.title || rec.name}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MODALE 2: SCHEDA DEDICATA PERSONA --- */}
      {personModal && (
        <div style={modalOverlay}>
          <div style={{ ...modalCard, maxWidth: '850px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              {navHistory.length > 0 ? (
                <button onClick={handleGoBack} style={backBtn}>
                  <ArrowLeft size={16} /> Indietro
                </button>
              ) : (
                <div />
              )}

              <button onClick={closeAllModals} style={closeModalBtn}>
                <X size={24} />
              </button>
            </div>

            {loadingPersonModal ? (
              <div
                style={{
                  color: '#94a3b8',
                  textAlign: 'center',
                  padding: '40px',
                }}
              >
                Caricamento profilo e filmografia...
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: 'flex',
                    gap: '20px',
                    flexWrap: 'wrap',
                    marginBottom: '20px',
                  }}
                >
                  <img
                    src={personModal.profilePath || PLACEHOLDER_IMG}
                    alt={personModal.name}
                    style={{
                      width: '140px',
                      height: '210px',
                      objectFit: 'cover',
                      borderRadius: '8px',
                    }}
                  />
                  <div style={{ flex: 1, minWidth: '260px' }}>
                    <h2
                      style={{
                        margin: '0 0 6px 0',
                        fontSize: '1.6rem',
                        color: '#38bdf8',
                      }}
                    >
                      {personModal.name}
                    </h2>
                    <div
                      style={{
                        color: '#94a3b8',
                        fontSize: '0.85rem',
                        marginBottom: '10px',
                      }}
                    >
                      <span>Ruolo principale: {personModal.knownFor}</span> •{' '}
                      <span>
                        Nascita: {personModal.birthday} (
                        {personModal.placeOfBirth})
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: '0.85rem',
                        lineHeight: '1.5',
                        color: '#cbd5e1',
                        maxHeight: '110px',
                        overflowY: 'auto',
                      }}
                    >
                      {personModal.biography}
                    </p>
                  </div>
                </div>

                <div
                  style={{ borderTop: '1px solid #1e293b', paddingTop: '14px' }}
                >
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '12px' }}>
                    Filmografia completa di {personModal.name}:
                  </h3>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fill, minmax(115px, 1fr))',
                      gap: '12px',
                      maxHeight: '360px',
                      overflowY: 'auto',
                    }}
                  >
                    {personCredits.map((c) => {
                      const isSaved = items.some(
                        (i) => String(i.id) === String(c.id)
                      );
                      return (
                        <div
                          key={c.id}
                          onClick={() => openItemDetails(c, true)}
                          style={{
                            background: '#151f38',
                            borderRadius: '6px',
                            overflow: 'hidden',
                            textAlign: 'center',
                            paddingBottom: '6px',
                            border: '1px solid #1e293b',
                            cursor: 'pointer',
                          }}
                        >
                          <img
                            src={`${TMDB_IMG}${c.poster_path}`}
                            alt=""
                            style={{
                              width: '100%',
                              height: '155px',
                              objectFit: 'cover',
                            }}
                            onError={(e) => {
                              e.target.src = PLACEHOLDER_IMG;
                            }}
                          />
                          <div
                            style={{
                              fontSize: '0.75rem',
                              padding: '4px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {c.title || c.name}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                            {(
                              c.release_date ||
                              c.first_air_date ||
                              ''
                            ).substring(0, 4)}
                          </div>
                          {isSaved && (
                            <div
                              style={{
                                fontSize: '0.65rem',
                                color: '#22c55e',
                                fontWeight: 'bold',
                                marginTop: '2px',
                              }}
                            >
                              In libreria
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CarouselSection({ title, items, onSelect, savedIds }) {
  return (
    <div>
      <h2
        style={{
          fontSize: '1.2rem',
          margin: '0 0 12px 0',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        {title}
      </h2>
      <div
        style={{
          display: 'flex',
          gap: '14px',
          overflowX: 'auto',
          paddingBottom: '10px',
        }}
      >
        {items.map((item) => {
          const isSaved = savedIds.includes(String(item.id));
          return (
            <div
              key={item.id}
              style={{
                minWidth: '150px',
                width: '150px',
                background: '#151f38',
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid #1e293b',
                cursor: 'pointer',
              }}
              onClick={() => onSelect(item)}
            >
              <img
                src={
                  item.poster_path
                    ? `${TMDB_IMG}${item.poster_path}`
                    : PLACEHOLDER_IMG
                }
                alt=""
                style={{ width: '100%', height: '220px', objectFit: 'cover' }}
                onError={(e) => {
                  e.target.src = PLACEHOLDER_IMG;
                }}
              />
              <div style={{ padding: '8px' }}>
                <div
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {item.title || item.name}
                </div>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#94a3b8',
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '4px',
                  }}
                >
                  <span>
                    {(item.release_date || item.first_air_date || '').substring(
                      0,
                      4
                    )}
                  </span>
                  <span style={{ color: '#f59e0b' }}>
                    ⭐ {item.vote_average?.toFixed(1)}
                  </span>
                </div>
                {isSaved && (
                  <div
                    style={{
                      fontSize: '0.7rem',
                      color: '#22c55e',
                      fontWeight: 'bold',
                      marginTop: '4px',
                    }}
                  >
                    In libreria
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const inputStyle = {
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '6px',
  color: '#f8fafc',
  padding: '8px 12px',
  outline: 'none',
  fontSize: '0.9rem',
};

const selectStyle = {
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '6px',
  color: '#f8fafc',
  padding: '8px 10px',
  outline: 'none',
  fontSize: '0.9rem',
};

const btnPrimary = {
  background: '#0284c7',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  padding: '8px 16px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontWeight: 'bold',
};

const btnSecondary = {
  background: '#334155',
  color: '#f8fafc',
  border: 'none',
  borderRadius: '6px',
  padding: '8px 14px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

const tabBtn = {
  border: 'none',
  color: '#f8fafc',
  padding: '8px 14px',
  borderRadius: '6px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '0.85rem',
  fontWeight: 'bold',
};

const modalOverlay = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.85)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000,
  padding: '16px',
};

const modalCard = {
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: '12px',
  maxWidth: '800px',
  width: '100%',
  maxHeight: '90vh',
  overflowY: 'auto',
  position: 'relative',
  padding: '24px',
};

const closeModalBtn = {
  background: 'transparent',
  border: 'none',
  color: '#94a3b8',
  cursor: 'pointer',
};

const backBtn = {
  background: '#1e293b',
  border: '1px solid #334155',
  color: '#38bdf8',
  padding: '6px 12px',
  borderRadius: '6px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '0.85rem',
  fontWeight: 'bold',
};
