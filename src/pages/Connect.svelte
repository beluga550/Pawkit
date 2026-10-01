<script>
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import PawLogo from "../components/PawLogo.svelte";
  import { useApp } from "../lib/context.js";
  import { checkServerName } from "../lib/validate.js";

  const { session } = useApp();
  const saved = session.profile;

  let name = $state(saved?.name ?? "");
  let host = $state(saved?.host ?? "");
  let port = $state(saved?.port ?? 25575);
  let password = $state("");
  let errors = $state({});
  let formError = $state("");

  async function submit(event) {
    event.preventDefault();
    const next = {};
    const checkedName = checkServerName(name);
    if (!checkedName.ok) next.name = checkedName.error;
    if (!host.trim() || /[\s/]/.test(host.trim())) next.host = "请输入 RCON 地址，例如 192.168.1.10";
    if (!Number.isInteger(port) || port < 1 || port > 65535) next.port = "端口是 1–65535 之间的整数";
    if (!password) next.password = "请输入 RCON 密码";
    errors = next;
    formError = "";
    if (Object.keys(next).length) return;
    const result = await session.connect({ name: checkedName.value, host: host.trim(), port }, password);
    password = "";
    if (!result.ok && result.error) formError = result.error.message;
  }
</script>

<main class="connect">
  <form class="card" onsubmit={submit} novalidate>
    <div class="brand">
      <span class="logo"><PawLogo /></span>
      <div>
        <strong>Pawkit</strong>
        <small>服务器控制台</small>
      </div>
    </div>

    <label class="field">
      服务器名称
      <input class="input" bind:value={name} maxlength="60" autocomplete="off" placeholder="生存一服" aria-invalid={Boolean(errors.name)} />
      {#if errors.name}<span class="field-error">{errors.name}</span>{/if}
    </label>
    <div class="row">
      <label class="field grow">
        RCON 地址
        <input class="input mono" bind:value={host} autocomplete="off" placeholder="192.168.1.10" aria-invalid={Boolean(errors.host)} />
        {#if errors.host}<span class="field-error">{errors.host}</span>{/if}
      </label>
      <label class="field port">
        RCON 端口
        <input class="input" type="number" min="1" max="65535" bind:value={port} aria-invalid={Boolean(errors.port)} />
        {#if errors.port}<span class="field-error">{errors.port}</span>{/if}
      </label>
    </div>
    <label class="field">
      RCON 密码
      <input class="input" type="password" bind:value={password} autocomplete="off" placeholder="每次启动都需要输入" aria-invalid={Boolean(errors.password)} />
      {#if errors.password}<span class="field-error">{errors.password}</span>{/if}
    </label>

    {#if formError}<p class="field-error" role="alert">{formError}</p>{/if}

    <button class="btn primary full" type="submit" disabled={session.connecting}>
      {#if session.connecting}<LoaderCircle size={16} class="spin" />{/if}
      连接服务器
    </button>
    <p class="note">密码只在本次运行期间保存在内存里。请通过可信局域网或加密隧道连接 RCON。</p>
  </form>
</main>

<style>
  .connect {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 24px;
    background:
      radial-gradient(900px 420px at 30% -10%, rgba(142, 230, 190, 0.08), transparent 60%),
      radial-gradient(700px 400px at 100% 110%, rgba(184, 147, 255, 0.06), transparent 60%),
      var(--s2);
  }
  .card {
    width: min(420px, 100%);
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 28px;
    border-radius: 18px;
    border: 1px solid var(--line-2);
    background: linear-gradient(180deg, var(--card-hi), var(--card));
    box-shadow: 0 40px 80px -30px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 4px;
  }
  .brand strong {
    display: block;
    font-family: var(--display);
    font-size: 19px;
  }
  .brand small {
    color: var(--text-3);
  }
  .logo {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    color: #06231a;
    background: linear-gradient(145deg, #b9f5d9, #5fd3a0);
    box-shadow: 0 6px 18px -6px rgba(95, 211, 160, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.5);
  }
  .row {
    display: flex;
    gap: 12px;
  }
  .grow {
    flex: 1;
  }
  .port {
    width: 110px;
  }
  .note {
    font-size: 12px;
    line-height: 1.6;
    color: var(--text-3);
  }
</style>
