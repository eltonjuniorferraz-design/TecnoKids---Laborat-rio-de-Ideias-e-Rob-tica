/* TecnoKids: autenticação do professor e salas de alunos sem e-mail. */
(function () {
    'use strict';

    const config = window.TECNOKIDS_SUPABASE_CONFIG;
    const ready = Boolean(config?.url && config?.publishableKey && window.supabase?.createClient);
    const db = ready ? window.supabase.createClient(config.url, config.publishableKey) : null;
    let teacherUser = null;
    let teacherRoom = null;
    let student = null;
    let currentStage = 1;
    let rosterTimer = null;
    let studentGalleryTimer = null;
    let sessionReady = false;
    let activityUpdateQueue = Promise.resolve();
    const stageLabels = ['Missões de lógica', 'Oficina maker', 'Mural e apresentação'];

    function status(message, isError = false) {
        const node = document.getElementById('teacherAuthStatus');
        if (node) {
            node.textContent = message;
            node.className = `mt-3 text-sm font-semibold ${isError ? 'text-rose-700' : 'text-slate-600'}`;
        }
    }

    function setTeacherAuthMode(mode) {
        const creating = mode === 'signup';
        const title = document.getElementById('teacherAuthTitle');
        const intro = document.getElementById('teacherAuthIntro');
        const password = document.getElementById('teacherPassword');
        const confirmWrap = document.getElementById('teacherPasswordConfirmWrap');
        const submit = document.getElementById('teacherAuthSubmit');
        const switchButton = document.getElementById('teacherAuthSwitch');
        const resetButton = document.getElementById('teacherPasswordResetButton');
        if (!title || !intro || !password || !confirmWrap || !submit || !switchButton || !resetButton) return;

        title.textContent = creating ? 'Crie sua conta de professor' : 'Entre para preparar sua sala';
        intro.textContent = creating
            ? 'Informe seu e-mail e crie uma senha com pelo menos 8 caracteres. Enviaremos uma confirmação para seu e-mail.'
            : 'Acesse sua conta com e-mail e senha. Ainda não tem uma conta? Você pode criar uma agora.';
        password.autocomplete = creating ? 'new-password' : 'current-password';
        confirmWrap.classList.toggle('hidden', !creating);
        submit.textContent = creating ? 'Criar minha conta' : 'Entrar';
        submit.setAttribute('onclick', `teacherAuth('${creating ? 'signup' : 'signin'}')`);
        submit.classList.toggle('bg-indigo-600', !creating);
        submit.classList.toggle('bg-amber-400', creating);
        submit.classList.toggle('text-slate-950', creating);
        submit.classList.toggle('text-white', !creating);
        switchButton.textContent = creating ? 'Já tenho conta · Voltar para entrar' : 'Criar conta de professor';
        switchButton.setAttribute('onclick', `setTeacherAuthMode('${creating ? 'signin' : 'signup'}')`);
        resetButton.classList.toggle('hidden', creating);
        document.getElementById('teacherPasswordConfirm').value = '';
        status('');
    }

    function isAnonymousSession(session) {
        try {
            const encoded = session?.access_token?.split('.')[1];
            if (!encoded) return false;
            const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
            return JSON.parse(atob(normalized)).is_anonymous === true;
        } catch { return false; }
    }

    function showTeacherDashboard(user, anonymous = false) {
        teacherUser = user || null;
        const authPanel = document.getElementById('teacherAuthPanel');
        const dashboard = document.getElementById('teacherDashboard');
        if (!authPanel || !dashboard) return;
        const isTeacher = Boolean(user && !anonymous);
        authPanel.classList.toggle('hidden', isTeacher);
        dashboard.classList.toggle('hidden', !isTeacher);
        if (isTeacher) {
            document.getElementById('teacherSignedInAs').textContent = `Conectado: ${user.email || 'Professor'}`;
            loadTeacherRoom();
        }
    }

    async function teacherAuth(mode) {
        if (!db) return status('A conexão online ainda não foi configurada neste site.', true);
        const email = document.getElementById('teacherEmail').value.trim();
        const password = document.getElementById('teacherPassword').value;
        if (!email || !password) return status('Informe seu e-mail e sua senha.', true);
        if (mode === 'signup') {
            const confirmation = document.getElementById('teacherPasswordConfirm').value;
            if (password.length < 8) return status('Crie uma senha com pelo menos 8 caracteres.', true);
            if (password !== confirmation) return status('As senhas não coincidem. Confira os dois campos.', true);
        }
        status('Conectando…');
        const result = mode === 'signup'
            ? await db.auth.signUp({ email, password })
            : await db.auth.signInWithPassword({ email, password });
        if (result.error) return status(result.error.message, true);
        if (mode === 'signup' && !result.data.session) {
            return status('Conta criada. Confira o e-mail para confirmar o cadastro e depois entre.');
        }
        status(mode === 'signup' ? 'Conta criada com sucesso.' : 'Entrada realizada.');
        showTeacherDashboard(result.data.session?.user || result.data.user, isAnonymousSession(result.data.session));
    }

    async function teacherPasswordReset() {
        if (!db) return status('A conexão online ainda não foi configurada neste site.', true);
        const email = document.getElementById('teacherEmail').value.trim();
        if (!email) return status('Digite seu e-mail para receber o link de recuperação.', true);
        const redirectTo = `${window.location.origin}${window.location.pathname}#professor`;
        const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo });
        status(error ? error.message : 'Se o e-mail estiver cadastrado, enviaremos um link de recuperação.');
    }

    async function teacherUpdatePassword() {
        if (!db) return;
        const password = document.getElementById('teacherNewPassword').value;
        if (password.length < 8) return status('Use uma senha com pelo menos 8 caracteres.', true);
        const { error } = await db.auth.updateUser({ password });
        if (error) return status(error.message, true);
        document.getElementById('passwordRecoveryPanel').classList.add('hidden');
        document.getElementById('teacherNewPassword').value = '';
        status('Senha atualizada. Entre com sua nova senha.');
        await db.auth.signOut();
    }

    async function teacherSignOut() {
        if (db) await db.auth.signOut();
        teacherUser = null;
        teacherRoom = null;
        if (rosterTimer) clearInterval(rosterTimer);
        rosterTimer = null;
        showTeacherDashboard(null);
        window.location.hash = '#inicio';
        renderAppRoute();
    }

    function newRoomCode() {
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        const bytes = new Uint8Array(7);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, value => alphabet[value % alphabet.length]).join('');
    }

    function renderQr(link) {
        document.getElementById('studentShareLink').value = link;
        document.getElementById('teacherShareResult').classList.remove('hidden');
        document.getElementById('teacherQrPanel').classList.remove('hidden');
        const host = document.getElementById('teacherQrCode');
        host.replaceChildren();
        try {
            const qr = qrcode(0, 'M');
            qr.addData(link, 'Byte');
            qr.make();
            host.innerHTML = qr.createSvgTag({ cellSize: 5, margin: 4, scalable: true });
        } catch {
            host.textContent = 'Copie o link para compartilhar com a turma.';
        }
    }

    async function createClassShare() {
        if (!db || !teacherUser) return status('Entre na conta do professor antes de criar a sala.', true);
        const title = (document.getElementById('classTitleInput').value.trim() || 'Desafio de Invenções').slice(0, 48);
        const instructions = document.getElementById('classInstructionsInput').value.trim().slice(0, 180);
        const code = newRoomCode();
        status('Criando sala…');
        const { data, error } = await db.from('classrooms').insert({ teacher_id: teacherUser.id, join_code: code, title, instructions }).select().single();
        if (error) return status(error.message, true);
        teacherRoom = data;
        activeTeacherSession = { id: data.id, code: data.join_code, title: data.title, instructions: data.instructions };
        galleryFilterRoomCode = data.join_code;
        const pageUrl = new URL(window.location.href);
        pageUrl.hash = `aluno|${encodeURIComponent(code)}|${encodeURIComponent(title)}|${encodeURIComponent(instructions)}`;
        document.getElementById('teacherRoomSummary').textContent = `Sala ${code} • ${title}. Os alunos entram com o QR e informam apenas o primeiro nome.`;
        document.getElementById('copyLinkStatus').textContent = '';
        renderQr(pageUrl.toString());
        document.getElementById('teacherLiveRoom').classList.remove('hidden');
        document.getElementById('teacherLiveTitle').textContent = `${title} · código ${code}`;
        status('Sala criada. O mural será atualizado conforme os alunos trabalham.');
        await refreshRoster();
        if (rosterTimer) clearInterval(rosterTimer);
        rosterTimer = setInterval(refreshRoster, 7000);
    }

    async function loadTeacherRoom() {
        if (!db || !teacherUser) return;
        const { data, error } = await db.from('classrooms').select('*').eq('teacher_id', teacherUser.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (error || !data) return;
        teacherRoom = data;
        activeTeacherSession = { id: data.id, code: data.join_code, title: data.title, instructions: data.instructions };
        galleryFilterRoomCode = data.join_code;
        document.getElementById('classTitleInput').value = data.title;
        document.getElementById('classInstructionsInput').value = data.instructions || '';
        const pageUrl = new URL(window.location.href);
        pageUrl.hash = `aluno|${encodeURIComponent(data.join_code)}|${encodeURIComponent(data.title)}|${encodeURIComponent(data.instructions || '')}`;
        document.getElementById('teacherRoomSummary').textContent = `Sala ${data.join_code} • ${data.title}`;
        renderQr(pageUrl.toString());
        document.getElementById('teacherLiveRoom').classList.remove('hidden');
        document.getElementById('teacherLiveTitle').textContent = `${data.title} · código ${data.join_code}`;
        await refreshRoster();
        if (rosterTimer) clearInterval(rosterTimer);
        rosterTimer = setInterval(refreshRoster, 7000);
    }

    async function refreshRoster() {
        if (!db || !teacherRoom) return;
        const [{ data: roster, error: rosterError }, { data: projects }] = await Promise.all([
            db.from('classroom_participants').select('id,first_name,current_stage,logic_complete,maker_complete,presentation_complete,last_seen_at').eq('classroom_id', teacherRoom.id).order('joined_at'),
            db.from('classroom_projects').select('id').eq('classroom_id', teacherRoom.id)
        ]);
        if (rosterError) return;
        const host = document.getElementById('teacherRoster');
        host.replaceChildren();
        document.getElementById('teacherLiveCount').textContent = `${roster.length} aluno(s) · ${projects?.length || 0} projeto(s)`;
        await loadRoomGallery(null, teacherRoom);
        if (!roster.length) {
            host.innerHTML = '<p class="text-sm text-slate-500">Aguardando os alunos entrarem pelo QR Code ou link.</p>';
            return;
        }
        roster.forEach(person => {
            const card = document.createElement('article');
            card.className = 'rounded-2xl border border-slate-200 bg-slate-50 p-3';
            const stage = Math.min(3, Math.max(1, Number(person.current_stage) || 1));
            const stageComplete = stage === 1 ? person.logic_complete : stage === 2 ? person.maker_complete : person.presentation_complete;
            const progressText = stageComplete ? 'Atividade concluída' : 'Em andamento';
            card.innerHTML = `<p class="font-extrabold text-indigo-950">${escapeHtml(person.first_name)}</p><p class="mt-1 text-xs font-semibold text-slate-600">${escapeHtml(stageLabels[stage - 1])} · ${progressText}</p>`;
            host.appendChild(card);
        });
    }

    async function enterStudentGame() {
        if (!db) return showToast('⚠️', 'A conexão online ainda não foi configurada.');
        const route = parseStudentRoute();
        const firstName = document.getElementById('studentTeamAlias').value.trim().split(/\s+/)[0].slice(0, 24);
        if (!route?.code || route.code === 'LIVRE') return showToast('🔗', 'Entre pelo link ou informe o código da sala do professor.');
        if (!firstName) return showToast('✏️', 'Informe seu primeiro nome para entrar.');
        const { data: sessionData, error: sessionError } = await db.auth.getSession();
        let user = sessionData.session?.user;
        if (user && !isAnonymousSession(sessionData.session)) return showToast('🔐', 'Este navegador está conectado como professor. Abra a atividade em outro aparelho ou saia da conta do professor antes.');
        if (!user) {
            const { data, error } = await db.auth.signInAnonymously();
            if (error) return showToast('⚠️', error.message);
            user = data.user;
        }
        const { data, error } = await db.rpc('join_classroom', { p_code: route.code, p_first_name: firstName });
        if (error) return showToast('⚠️', error.message);
        const joined = Array.isArray(data) ? data[0] : data;
        student = { id: user.id, roomId: joined.room_id, code: route.code, firstName };
        activeStudentSession = { code: route.code, title: joined.room_title, instructions: joined.room_instructions, roomId: joined.room_id };
        currentStage = 1;
        const { data: progress } = await db.from('classroom_participants').select('current_stage').eq('id', user.id).maybeSingle();
        if (progress) currentStage = progress.current_stage;
        state.teamName = firstName;
        state.roomCode = route.code;
        saveToStorage();
        document.getElementById('teamNameInput').value = firstName;
        document.getElementById('teamNameInput').readOnly = true;
        document.getElementById('studentClassTitle').textContent = joined.room_title;
        document.getElementById('studentInstructions').textContent = joined.room_instructions || 'Explore as estações, crie sua ideia e prepare-se para apresentar.';
        applyStageAccess();
        await loadRoomGallery();
        if (studentGalleryTimer) clearInterval(studentGalleryTimer);
        studentGalleryTimer = setInterval(loadRoomGallery, 10000);
        window.location.hash = '#jogo';
        renderAppRoute();
        showToast('🚀', `Bem-vindo(a), ${firstName}!`);
    }

    async function loadRoomGallery(room = student, roomRow = teacherRoom) {
        const roomId = room?.roomId || roomRow?.id;
        const roomCode = room?.code || roomRow?.join_code;
        if (!db || !roomId) return;
        const { data, error } = await db.from('classroom_projects')
            .select('id,classroom_id,participant_id,title,description,maker_choices,is_presented,created_at,classroom_participants(first_name)')
            .eq('classroom_id', roomId).order('created_at', { ascending: false });
        if (error) return;
        state.gallery = (data || []).map(item => ({
            id: item.id, roomCode, team: item.classroom_participants?.first_name || 'Aluno', name: item.title,
            desc: item.description, problemId: item.maker_choices?.problem, sensorId: item.maker_choices?.sensor,
            actionId: item.maker_choices?.action, votes: 0
        }));
        galleryFilterRoomCode = roomCode;
        renderGallery();
        updateScoreboard();
    }

    async function syncNewestProject() {
        if (!db || !student?.roomId || !state.gallery.length) return;
        const item = state.gallery[0];
        const { error } = await db.from('classroom_projects').upsert({
            classroom_id: student.roomId,
            participant_id: student.id,
            title: item.name,
            description: item.desc || '',
            maker_choices: { problem: item.problemId, sensor: item.sensorId, action: item.actionId },
            is_presented: false,
            updated_at: new Date().toISOString()
        }, { onConflict: 'participant_id' });
        if (error) showToast('⚠️', 'Não foi possível sincronizar o projeto: ' + error.message);
        else {
            await trackStudentActivity(2, true);
            await loadRoomGallery();
        }
    }

    function trackStudentActivity(stage, completed = false) {
        if (!db || !student || ![1, 2, 3].includes(stage)) return false;
        activityUpdateQueue = activityUpdateQueue.then(async () => {
            const { data, error } = await db.rpc('track_classroom_activity', { p_stage: stage, p_completed: completed });
            if (error) { showToast('⚠️', 'Não foi possível atualizar o progresso da atividade.'); return false; }
            currentStage = Number(data) || stage;
            return true;
        });
        return activityUpdateQueue;
    }

    function applyStageAccess() {
        if (!student) return;
        const stations = ['logic', 'maker', 'gallery'];
        stations.forEach(name => {
            const button = document.getElementById(`tabBtn_${name}`);
            if (!button) return;
            button.disabled = false;
            button.setAttribute('aria-disabled', 'false');
            button.title = '';
            button.classList.remove('opacity-50', 'cursor-not-allowed');
        });
        const finish = document.getElementById('finishPresentationBtn');
        if (finish) finish.classList.remove('hidden');
    }

    async function completeStudentPresentation() {
        if (!db || !student) return showToast('⚠️', 'Entre na sala para registrar sua apresentação.');
        const { data: project, error: projectError } = await db.from('classroom_projects').select('id').eq('participant_id', student.id).maybeSingle();
        if (projectError) return showToast('⚠️', 'Não foi possível verificar o projeto: ' + projectError.message);
        if (!project) return showToast('💡', 'Salve sua invenção na Oficina Maker antes de concluir a apresentação.');
        const { error } = await db.from('classroom_projects').update({ is_presented: true, updated_at: new Date().toISOString() }).eq('participant_id', student.id);
        if (error) return showToast('⚠️', 'Não foi possível registrar a apresentação: ' + error.message);
        await trackStudentActivity(3, true);
        await loadRoomGallery();
        showToast('🎤', 'Apresentação concluída! O professor já pode acompanhar.');
    }

    const originalSwitchTab = window.switchTab;
    window.switchTab = function (tab) {
        const result = originalSwitchTab(tab);
        const stage = { logic: 1, maker: 2, gallery: 3 }[tab];
        if (student && stage) trackStudentActivity(stage, false);
        return result;
    };

    const originalRenderAppRoute = window.renderAppRoute;
    window.renderAppRoute = function () {
        if (window.location.hash.slice(1) === 'jogo' && !sessionReady) {
            ['gameAppHeader', 'gameAppMain', 'gamePrivacyNote'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
            return;
        }
        if (window.location.hash.slice(1) === 'jogo' && !teacherUser && !student) {
            window.location.hash = '#inicio';
            return originalRenderAppRoute();
        }
        return originalRenderAppRoute();
    };

    const originalVictory = window.handleLevelVictory;
    window.handleLevelVictory = function () {
        originalVictory();
        if (student && Array.isArray(state.completedLevels) && state.completedLevels.length >= 4) {
            trackStudentActivity(1, true);
        }
    };

    const originalOpenTeacherGallery = window.openTeacherGallery;
    window.openTeacherGallery = async function () {
        if (teacherRoom) await loadRoomGallery(null, teacherRoom);
        return originalOpenTeacherGallery();
    };

    const originalSaveInvention = window.saveInventionToGallery;
    window.saveInventionToGallery = function () {
        const before = state.gallery.length;
        originalSaveInvention();
        if (!student || state.gallery.length <= before) return;
        syncNewestProject();
    };

    async function initialize() {
        if (!db) {
            const note = document.getElementById('teacherAuthStatus');
            if (note) note.textContent = 'Configure o projeto Supabase para ativar contas e salas online.';
            sessionReady = true;
            return;
        }
        db.auth.onAuthStateChange((event, session) => {
            const user = session?.user;
            if (event === 'PASSWORD_RECOVERY') {
                document.getElementById('passwordRecoveryPanel').classList.remove('hidden');
                status('Defina uma nova senha para sua conta.');
                window.location.hash = '#professor';
                window.renderAppRoute();
                return;
            }
            if (user && !isAnonymousSession(session)) showTeacherDashboard(user);
            if (!user) showTeacherDashboard(null);
            sessionReady = true;
            window.renderAppRoute();
        });
        const { data } = await db.auth.getSession();
        const session = data.session;
        const user = session?.user;
        const anonymous = isAnonymousSession(session);
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const queryParams = new URLSearchParams(window.location.search);
        if (hashParams.get('type') === 'recovery' || queryParams.get('type') === 'recovery') {
            document.getElementById('passwordRecoveryPanel').classList.remove('hidden');
            status('Defina uma nova senha para sua conta.');
            window.location.hash = '#professor';
        }
        if (user && !anonymous) showTeacherDashboard(user);
        else if (user && anonymous) {
            const code = String(state.roomCode || '').toUpperCase();
            const firstName = String(state.teamName || '').trim().split(/\s+/)[0].slice(0, 24);
            if (code && firstName && window.location.hash.slice(1) === 'jogo') {
                const { data: joined, error } = await db.rpc('join_classroom', { p_code: code, p_first_name: firstName });
                if (!error) {
                    const room = Array.isArray(joined) ? joined[0] : joined;
                    student = { id: user.id, roomId: room.room_id, code, firstName };
                    activeStudentSession = { code, title: room.room_title, instructions: room.room_instructions, roomId: room.room_id };
                    const { data: progress } = await db.from('classroom_participants').select('current_stage').eq('id', user.id).maybeSingle();
                    currentStage = progress?.current_stage || 1;
                    document.getElementById('teamNameInput').value = firstName;
                    document.getElementById('teamNameInput').readOnly = true;
                    applyStageAccess();
                    await loadRoomGallery();
                    studentGalleryTimer = setInterval(loadRoomGallery, 10000);
                }
            }
        }
        sessionReady = true;
        window.renderAppRoute();
        if (parseStudentRoute()) document.getElementById('studentTeamAlias')?.focus({ preventScroll: true });
    }

    window.teacherAuth = teacherAuth;
    window.setTeacherAuthMode = setTeacherAuthMode;
    window.teacherPasswordReset = teacherPasswordReset;
    window.teacherUpdatePassword = teacherUpdatePassword;
    window.teacherSignOut = teacherSignOut;
    window.createClassShare = createClassShare;
    window.enterStudentGame = enterStudentGame;
    window.completeStudentPresentation = completeStudentPresentation;
    window.addEventListener('DOMContentLoaded', initialize);
})();

