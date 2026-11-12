# Аватарки fake SDK

Набор из 15 синтетических портретов создан встроенным генератором изображений
OpenAI 30 октября 2026 года по текстовым описаниям, без входных фотографий.
Это демонстрационные изображения, не фотографии пользователей платформ.
Сходство с реальными людьми независимо не проверялось.

Рабочий формат — WebP 256×256. Изображения встроены как data URI в
`src/fake/avatar-photos.ts`, поэтому исходники и собранный npm-пакет работают
без внешних запросов и отдельного копирования файлов изображений.
Общая функция `avatarDataUri` используется fake SDK Яндекса и VK;
без явного индекса для одинакового seed и группы возвращается один и тот же портрет.
В каждой выдаче рейтинга портреты назначаются по кругу отдельно для мужчин
и женщин; повтор происходит после исчерпания группы (7 мужских, 8 женских).
Имена также выбираются без повторов до исчерпания каталога.
Язык fake SDK выбирает каталог имён: русский (`ru`), английский (`en`),
испанский (`es`), турецкий (`tr`), немецкий (`de`).
В браузере язык fake SDK задаётся URL-параметром `lang`, например `lang=tr`.
В каталоге вымышленных игроков явно указана группа портретов для мужских и
женских имён. Для нейтральных никнеймов доступен весь набор; пол реального
пользователя по имени не определяется.
SVG-контейнер сохраняет запрошенные размеры SDK; детализация фотографии — 256×256.

Условия сервиса: https://openai.com/policies/terms-of-use/.
Это запись происхождения, а не заявление о CC0 или исключительности изображений.
Исходные WebP и манифест хранятся в `assets/fake-avatars/`.

## Обновление набора

Команды выполняются из корня репозитория.

1. Создать отдельный портрет по одному из промптов ниже или его вариации.
   Использовался встроенный инструмент OpenAI; точный идентификатор модели
   инструмент не сообщил. Генерация недетерминирована: тот же промпт может дать другое лицо.
2. Проверить лицо, анатомию, отсутствие текста и пригодность для маленькой круглой аватарки.
   Входные фотографии реальных людей и изображения знаменитостей не использовались.
3. Если результат крупнее, уменьшить до 256×256 фильтром Lanczos и сохранить
   как WebP с quality=90. Для неквадратного результата сначала выбрать квадратный
   кадр с целой головой. Хранить только итоговый WebP, без больших оригиналов.
4. Добавить файл `man-<описание>-256.webp` или `woman-<описание>-256.webp`
   в `assets/fake-avatars/`, а в `manifest.json` — имя, группу, размер и SHA-256.
   Промпт добавить в этот документ под заголовком с именем файла.
   SHA-256 можно получить командой `sha256sum assets/fake-avatars/<файл>.webp`.
5. Выполнить `pnpm run avatars:build`, затем `pnpm test`, `pnpm run typecheck`,
   `pnpm run build`. Команда `avatars:build` работает локально: только встраивает
   существующие изображения в TypeScript, не запускает нейросеть или браузер.
6. Сохранять в Git исходные WebP, манифест, этот документ и обновлённый `avatar-photos.ts`.

В runtime изображения попадают через `avatar-photos.ts`. В npm-пакет включается
скомпилированный модуль из `dist`; папка `assets` для выполнения пакета не нужна.
Прямое редактирование base64 в TypeScript не требуется — источником служат WebP
и манифест. Порядок записей манифеста определяет порядок портретов в цикле.
Имена и их переводы редактируются отдельно в `src/fake/YgFakeLeaderboard.ts`.
В fake SDK они выбираются параметром URL `lang=ru|en|es|tr|de`.

## Промпты генерации

### prompts.md

# Avatar previews

Delivery format: 256×256 WebP only. If generation produces larger images, resize them and keep only the final WebP files in this folder.

Generated with the built-in OpenAI image generation tool. Fictional subjects; no reference photographs used.

## woman-window-256.webp

Use case: photorealistic-natural. Create one square realistic photograph for a game leaderboard avatar of a completely fictional woman about 35, shoulder-length chestnut hair, gentle friendly smile, ordinary casual clothing. A candid smartphone selfie near a window at home, soft natural daylight, softly blurred unremarkable home background. Natural skin texture, subtle facial asymmetry, no beauty retouching or glamour look. Head and shoulders, face centered and filling about 60% of image, entire head visible with enough margin for circular cropping. Readable at small icon size. No text, logos, frames, watermark, other people, or resemblance to celebrities. Single photograph, not a collage.

## man-park-256.webp

Use case: photorealistic-natural. Create one square realistic photograph for a game leaderboard avatar of a completely fictional man about 50, short salt-and-pepper hair, a little stubble, relaxed friendly smile, simple casual jacket. Candid photo taken by a friend on a walk in a park, soft overcast daylight, softly blurred green foliage background, ordinary smartphone snapshot character. Natural skin texture and age lines, no fashion-model pose or advertising retouching. Head and shoulders with face large and centered, whole head visible with margin for circular cropping, readable at small icon size. No text, logos, frames, watermark, other people, or resemblance to celebrities. Single photograph, not a collage.

### prompts-2.md

# Generated avatar prompts

Built-in OpenAI image generation. Final assets: 256×256 WebP. Fictional subjects, no input photographs; resemblance to real people has not been independently checked.

## woman-cafe-256.webp

Use case: photorealistic-natural. Single realistic square avatar photograph of a completely fictional woman about 28. Dark curly hair, thin round eyeglasses, medium brown skin, slight friendly smile, casual clothing. Ordinary candid smartphone selfie in a cozy cafe, soft window light, blurred background. Natural skin texture, no beauty retouching, no advertising staging. Head and shoulders, large centered face with comfortable margin around entire head for circular cropping. Clearly readable as a 256x256 avatar. No text, logos, frames, watermarks or other people. Do not depict or resemble a celebrity. One image, not a collage.

## man-seaside-256.webp

Use case: photorealistic-natural. Single realistic square avatar photograph of a completely fictional East Asian man about 35. Short black hair a little tousled by wind, clean-shaven, warm open smile, simple light T-shirt. Candid smartphone photo during a seaside walk, diffuse daylight, softly blurred blue sea background. Natural skin texture, no glamour retouching, no advertising staging. Head and shoulders, large centered face with comfortable margin around entire head for circular cropping. Clearly readable as a 256x256 avatar. No text, logos, frames, watermarks or other people. Do not depict or resemble a celebrity. One image, not a collage.

## woman-garden-256.webp

Use case: photorealistic-natural. Single realistic square avatar photograph of a completely fictional woman about 60. Short silver haircut, lively brown eyes, natural wrinkles, warm smile, casual blue shirt. Smartphone photo taken by a family member in a garden, soft light in tree shade, blurred greenery and a few flowers behind her. Natural skin texture, no age-reduction or beauty retouching, no glamour or studio staging. Head and shoulders, large centered face with comfortable margin around entire head for circular cropping. Clearly readable as a 256x256 avatar. No text, logos, frames, watermarks or other people. Do not depict or resemble a celebrity. One image, not a collage.

### prompts-3.md

# Avatar batch: ten portraits

Generated using the built-in OpenAI image tool, without reference photos. Final workspace assets: 256×256 WebP only.

## man-library-256.webp

Use case: photorealistic-natural. Generate a single square realistic avatar photograph. A completely fictional man about 42, dark brown skin, shaved head, subtle smile, thin rectangular reading glasses, casual burgundy sweater. Candid smartphone photo taken by a friend beside bookshelves in a local library, soft window light, blurred shelves. Natural skin texture, realistic age details and subtle asymmetry. Ordinary personal snapshot, not a studio headshot, no beauty filters, no advertising or glamour retouching. Head and shoulders with face large, approximately centered, entire head visible with comfortable margin for circular cropping. Readable at 256x256. No text, brand logos, frames, watermarks or additional people. No resemblance to any celebrity or intended real person. One photo only, no collage.

## woman-city-256.webp

Use case: photorealistic-natural. Generate a single square realistic avatar photograph. A completely fictional woman about 32, pale freckled skin, short copper-red bob, cheerful smile, navy casual coat. Candid smartphone portrait on a quiet city street, diffuse cloudy daylight, blurred brick buildings. Natural skin texture, realistic age details and subtle asymmetry. Ordinary personal snapshot, not a studio headshot, no beauty filters, no advertising or glamour retouching. Head and shoulders with face large, approximately centered, entire head visible with comfortable margin for circular cropping. Readable at 256x256. No text, brand logos, frames, watermarks or additional people. No resemblance to any celebrity or intended real person. One photo only, no collage.

## man-workshop-256.webp

Use case: photorealistic-natural. Generate a single square realistic avatar photograph. A completely fictional man about 58, olive skin, wavy graying hair, neat mustache, kind relaxed expression, plain denim shirt. Smartphone portrait in a home woodworking workshop, soft daylight, blurred wooden shelves, no tools obscuring face. Natural skin texture, realistic age details and subtle asymmetry. Ordinary personal snapshot, not a studio headshot, no beauty filters, no advertising or glamour retouching. Head and shoulders with face large, approximately centered, entire head visible with comfortable margin for circular cropping. Readable at 256x256. No text, brand logos, frames, watermarks or additional people. No resemblance to any celebrity or intended real person. One photo only, no collage.

## woman-balcony-256.webp

Use case: photorealistic-natural. Generate a single square realistic avatar photograph. A completely fictional woman about 45, East Asian appearance, straight black shoulder-length hair with a few gray strands, calm warm smile, casual cream cardigan. Candid smartphone selfie on a balcony with green potted plants, soft morning light. Natural skin texture, realistic age details and subtle asymmetry. Ordinary personal snapshot, not a studio headshot, no beauty filters, no advertising or glamour retouching. Head and shoulders with face large, approximately centered, entire head visible with comfortable margin for circular cropping. Readable at 256x256. No text, brand logos, frames, watermarks or additional people. No resemblance to any celebrity or intended real person. One photo only, no collage.

## man-hiking-256.webp

Use case: photorealistic-natural. Generate a single square realistic avatar photograph. A completely fictional man about 26, light brown skin, dark curly hair, clean-shaven, broad genuine smile, simple forest-green hiking fleece. Smartphone photograph taken by a friend during a woodland walk, soft shaded daylight, blurred forest. Natural skin texture, realistic age details and subtle asymmetry. Ordinary personal snapshot, not a studio headshot, no beauty filters, no advertising or glamour retouching. Head and shoulders with face large, approximately centered, entire head visible with comfortable margin for circular cropping. Readable at 256x256. No text, brand logos, frames, watermarks or additional people. No resemblance to any celebrity or intended real person. One photo only, no collage.

## woman-kitchen-256.webp

Use case: photorealistic-natural. Generate a single square realistic avatar photograph. A completely fictional woman about 53, deep brown skin, short natural textured black hair, subtle laugh lines, friendly smile, mustard yellow casual blouse. Candid smartphone photo in an ordinary home kitchen, gentle daylight, softly blurred background. Natural skin texture, realistic age details and subtle asymmetry. Ordinary personal snapshot, not a studio headshot, no beauty filters, no advertising or glamour retouching. Head and shoulders with face large, approximately centered, entire head visible with comfortable margin for circular cropping. Readable at 256x256. No text, brand logos, frames, watermarks or additional people. No resemblance to any celebrity or intended real person. One photo only, no collage.

## man-courtyard-256.webp

Use case: photorealistic-natural. Generate a single square realistic avatar photograph. A completely fictional man about 68, fair skin, thinning white hair, round wire eyeglasses, clean-shaven, slightly mischievous gentle smile, light blue casual sweater. Smartphone portrait taken by a relative in a leafy courtyard, diffuse daylight. Natural skin texture, realistic age details and subtle asymmetry. Ordinary personal snapshot, not a studio headshot, no beauty filters, no advertising or glamour retouching. Head and shoulders with face large, approximately centered, entire head visible with comfortable margin for circular cropping. Readable at 256x256. No text, brand logos, frames, watermarks or additional people. No resemblance to any celebrity or intended real person. One photo only, no collage.

## woman-train-256.webp

Use case: photorealistic-natural. Generate a single square realistic avatar photograph. A completely fictional woman about 24, olive skin, dark brown eyes, dark hair loosely tied back with stray wisps, small closed-mouth smile, plain rust-colored shirt. Casual smartphone selfie beside a train window, soft window light, softly blurred neutral carriage interior. Natural skin texture, realistic age details and subtle asymmetry. Ordinary personal snapshot, not a studio headshot, no beauty filters, no advertising or glamour retouching. Head and shoulders with face large, approximately centered, entire head visible with comfortable margin for circular cropping. Readable at 256x256. No text, brand logos, frames, watermarks or additional people. No resemblance to any celebrity or intended real person. One photo only, no collage.

## man-coffee-256.webp

Use case: photorealistic-natural. Generate a single square realistic avatar photograph. A completely fictional man about 37, South Asian appearance, medium brown skin, short neatly cropped black hair, trimmed beard, relaxed friendly smile, casual gray polo shirt. Candid smartphone photo sitting outside a neighborhood coffee shop, shaded daylight, softly blurred cafe background. Natural skin texture, realistic age details and subtle asymmetry. Ordinary personal snapshot, not a studio headshot, no beauty filters, no advertising or glamour retouching. Head and shoulders with face large, approximately centered, entire head visible with comfortable margin for circular cropping. Readable at 256x256. No text, brand logos, frames, watermarks or additional people. No resemblance to any celebrity or intended real person. One photo only, no collage.

## woman-lakeside-256.webp

Use case: photorealistic-natural. Generate a single square realistic avatar photograph. A completely fictional woman about 70, fair naturally weathered skin, short softly wavy gray hair, bright blue eyes, gentle smile, simple lavender jacket. Smartphone photo taken by family during a lakeside walk, soft overcast light, blurred water and reeds. Natural skin texture, realistic age details and subtle asymmetry. Ordinary personal snapshot, not a studio headshot, no beauty filters, no advertising or glamour retouching. Head and shoulders with face large, approximately centered, entire head visible with comfortable margin for circular cropping. Readable at 256x256. No text, brand logos, frames, watermarks or additional people. No resemblance to any celebrity or intended real person. One photo only, no collage.
