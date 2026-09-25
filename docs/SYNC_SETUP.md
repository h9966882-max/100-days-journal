# 100日ジャーナル｜初回の同期設定

この設定は一度だけ。鍵をチャットやGitHubへ貼り付けないでください。
回答の正本はNotion。WebはNotionを読み、Dialyにある専用ミラーから表示します。

## 1. Notionに、読み取り専用の接続を作る

NotionのDeveloper portalで「Internal connections（内部接続）」を開き、新しい接続を作成します。名前は「100日ジャーナル同期」など。
Configurationで **Read content（コンテンツを読み取る）** を有効にします。Update content・Insert contentはこの同期には不要です。
Installation access tokenをコピーします。これが後で使う `J100_NOTION_TOKEN` です。

Content access → Edit access で **〈100JDB〉100日ジャーナリング** を選びます。
または、Notionの正本DBの右上「…」→「コネクト／Connections」→「接続を追加」で、今作った接続を追加します。
Journal Homeのリンク集ではなく、100JDBそのものを指定してください。ワークスペース全体やAtlasの親ページを公開・共有する必要はありません。

## 2. Supabase「Dialy」に2つの設定を保存

[DialyのEdge Function Secrets](https://supabase.com/dashboard/project/wvsogabeckhuhcqelpja/functions/secrets) を開きます。

| Name | Value |
|---|---|
| `J100_NOTION_TOKEN` | 手順1でコピーしたInstallation access token |
| `J100_OWNER_EMAIL` | このWebジャーナルへログインするときに使っているメールアドレス |

Saveで保存します。キーの値をチャット・スクショ・公開コードに写さないでください。
NotionのログインメールとWebのログインメールが違う場合、**Webのログインメール**を使います。
他のアプリが使っている既存SecretsやAuth設定は変更しません。

## 3. ジャーナルへ戻る

[100日ジャーナル](https://h9966882-max.github.io/100-days-journal/?v=2.1.0-sync) に戻り、画面下部の **「Notionと同期」** を押します。
成功すると「Notionと同期しました」と日時が表示されます。Originalは100問、FollowはNotionで登録されている問だけを表示します。

## 自動更新の範囲

ログイン時、画面へ戻ったとき、表示中は約30秒ごとに確認します。短時間の連打や複数画面の同時取得は抑制します。
アプリを閉じている間の定期ジョブではありません。次に開くと更新を取りに行きます。
ネットワークやNotionが一時的に失敗しても、最後に正常保存したミラーは上書きしません。取得に失敗した表示を「同期成功」とは扱いません。

## 表示が進まないとき

- 「初回設定」：上の2項目を確認します。
- 「所有者」：Webへログインしたメールが `J100_OWNER_EMAIL` と一致するか確認します。
- 「Notionの読み取り権限」：トークンと100JDBへの接続許可を確認します。
- 「重複・不足や項目の変更」：元DBの列名・設問番号などを篤史が確認します。ユーザー側で削除しないでください。
- 「最新の同期に失敗」：最後の同期日時を確認。回答を再入力する必要はありません。

初回成功後、所有者のSupabaseユーザーIDを固定します。別アカウントへ引き継ぐ場合は管理作業が必要です。メール設定の変更だけでは所有者を入れ替えません。

## 試験の区別

実装・ローカル試験済みでも、**本物のNotionトークンを設定した後の往復試験は別**です。最初の同期成功を確認してから、本人の回答を使う運用へ進みます。
試験用の架空回答を実DBへ入れたり、Notionの本人回答を勝手に変えたりしません。

## 公式資料

- [Notion内部接続・アクセス権](https://developers.notion.com/guides/get-started/internal-connections)
- [Supabase Secrets](https://supabase.com/docs/guides/functions/secrets)
- [Supabase Edge Functions認証](https://supabase.com/docs/guides/functions/auth)
