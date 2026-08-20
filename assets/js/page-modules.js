/*
 * ================================================================
 * HUNDESALON NIKA — Page Modules
 * ================================================================
 * Page-specific interactive logic: booking modal, sendmail forms,
 * message draft tools, and smooth hash-link scrolling.
 * Loaded on pages that need specialised behaviour beyond main.js.
 *
 * Version: 2026-04-20
 * ================================================================
 */
document.addEventListener('DOMContentLoaded', () => {
  const PET_PHOTO_MAX_BYTES = 150 * 1024 * 1024;
  const PET_PHOTO_PROXY_MAX_BYTES = 90 * 1024 * 1024;
  const PET_PHOTO_ALLOWED_TYPES = ['image/jpeg', 'image/png'];
  const pageLang = (document.documentElement.lang || 'ru').toLowerCase().slice(0, 2);
  const scrollRoot = document.querySelector('.site-scroll-root');

  const bookingCopyByLang = {
    ru: {
      weekdays: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
      services: ['Полный груминг собаки', 'Экспресс-линька', 'Гигиенический уход', 'Груминг кошки', 'СПА-уход', 'Ваши предложения'],
      fallbackService: 'Выбранная услуга',
      chooseService: 'Выберите услугу',
      chooseBreed: 'Выберите породу или категорию питомца',
      serviceStep: '1. Порода и услуга',
      datetimeStep: '2. Дата и время привода',
      datetimeTitle: 'Выберите дату и время привода',
      breedLabel: 'Порода или категория',
      serviceLabel: 'Подходящая услуга',
      priceLabel: 'Ориентировочная цена',
      chooseBreedFirst: 'Сначала выберите породу или категорию питомца',
      noServiceForBreed: 'Для выбранной породы пока нет доступной услуги.',
      chooseDate: 'Выберите дату',
      chooseTime: 'Выберите время привода',
      chooseContact: 'Заполните имя, email и телефон',
      petRegistration: {
        legend: 'Данные питомца для учёта записи',
        intro: 'Данные нужны для внутреннего учёта клиента и питомца и не публикуются на сайте.',
        name: 'Кличка питомца',
        species: 'Вид животного',
        breed: 'Порода',
        age: 'Возраст или дата рождения',
        sex: 'Пол',
        sexChoose: 'Не указан',
        female: 'Самка',
        male: 'Самец',
        tag: 'Номер жетона',
        speciesChoose: 'Выберите вид',
        auto: 'Определяется автоматически по выбранной породе',
        dog: 'Собака',
        cat: 'Кошка',
        smallAnimal: 'Мелкое животное',
        rabbit: 'Кролик',
        guineaPig: 'Морская свинка',
        other: 'Другое',
      },
      choosePrivacy: 'Подтвердите согласие на обработку персональных данных',
      chooseAgb: 'Подтвердите ознакомление с правилами салона (AGB)',
      paymentRedirect: 'Переходим к безопасной онлайн-оплате…',
      paymentUnavailable:
        'Онлайн-оплата пока отключена. Выберите оплату в салоне (наличные или карта).',
      paymentSuccess: 'Онлайн-предоплата получена. Запись отправлена в салон.',
      dateInPast: 'Выберите будущую дату',
      fileType: 'Можно загрузить только JPG или PNG',
      fileSize: 'Файл должен быть не больше 150 МБ',
      fileUploadFailed: 'Не удалось загрузить фото. Попробуйте ещё раз или отправьте запись без файла.',
      chooseFile: 'Выбрать файл',
      noFileChosen: 'Файл не выбран',
      summaryTitle: 'Проверьте запись перед отправкой',
      summaryConfirm: 'Подтвердить и отправить',
      summaryEdit: 'Изменить данные',
      labels: {
        service: 'Услуга',
        breed: 'Порода',
        servicePrice: 'Цена',
        date: 'Дата',
        time: 'Время привода',
        name: 'Имя',
        email: 'Email',
        phone: 'Телефон',
        petName: 'Питомец',
        petSpecies: 'Вид животного',
        petBreed: 'Порода питомца',
        petAge: 'Возраст / дата рождения',
        petSex: 'Пол питомца',
        petTag: 'Номер жетона',
        payment: 'Оплата',
        file: 'Файл',
        payNow: 'Онлайн-предоплата',
        payLater: 'Оплата в салоне',
        paySalonCash: 'Наличные в салоне',
        paySalonCard: 'Карта в салоне',
        payOnline: 'Онлайн-предоплата (Stripe)',
        noFile: 'Без файла',
      },
      closeModal: 'Закрыть окно',
      datetimePickDate: 'Сначала выберите дату в календаре',
      datetimePickTime: 'Теперь выберите удобное время привода',
      datetimeDateChosen: 'Дата выбрана',
    },
    uk: {
      weekdays: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'],
      services: ['Повний грумінг собаки', 'Експрес-линька', 'Гігієнічний догляд', 'Грумінг кота', 'СПА-догляд', 'Ваші пропозиції'],
      fallbackService: 'Обрана послуга',
      chooseService: 'Оберіть послугу',
      chooseBreed: 'Оберіть породу або категорію улюбленця',
      serviceStep: '1. Порода та послуга',
      datetimeStep: '2. Дата й час привезення',
      datetimeTitle: 'Оберіть дату й час привезення',
      breedLabel: 'Порода або категорія',
      serviceLabel: 'Доступна послуга',
      priceLabel: 'Орієнтовна вартість',
      chooseBreedFirst: 'Спочатку оберіть породу або категорію улюбленця',
      noServiceForBreed: 'Для обраної породи наразі немає доступної послуги.',
      chooseDate: 'Оберіть дату',
      chooseTime: 'Оберіть час привезення',
      chooseContact: 'Заповніть імʼя, email і телефон',
      petRegistration: {
        legend: 'Дані улюбленця для обліку запису',
        intro: 'Дані потрібні для внутрішнього обліку клієнта й улюбленця та не публікуються на сайті.',
        name: 'Кличка улюбленця',
        species: 'Вид тварини',
        breed: 'Порода',
        age: 'Вік або дата народження',
        sex: 'Стать',
        sexChoose: 'Не вказано',
        female: 'Самка',
        male: 'Самець',
        tag: 'Номер жетона',
        speciesChoose: 'Оберіть вид',
        auto: 'Визначається автоматично за обраною породою',
        dog: 'Собака',
        cat: 'Кіт',
        smallAnimal: 'Дрібна тварина',
        rabbit: 'Кролик',
        guineaPig: 'Морська свинка',
        other: 'Інше',
      },
      choosePrivacy: 'Підтвердьте згоду на обробку персональних даних',
      chooseAgb: 'Підтвердьте ознайомлення з правилами салону (AGB)',
      paymentRedirect: 'Переходимо до безпечної онлайн-оплати…',
      paymentUnavailable:
        'Онлайн-оплата поки вимкнена. Оберіть оплату в салоні (готівка або картка).',
      paymentSuccess: 'Онлайн-передоплату отримано. Запис надіслано в салон.',
      dateInPast: 'Оберіть майбутню дату',
      fileType: 'Можна завантажити лише JPG або PNG',
      fileSize: 'Файл має бути не більше 150 МБ',
      fileUploadFailed: 'Не вдалося завантажити фото. Спробуйте ще раз або надішліть запис без файлу.',
      chooseFile: 'Обрати файл',
      noFileChosen: 'Файл не обрано',
      summaryTitle: 'Перевірте запис перед надсиланням',
      summaryConfirm: 'Підтвердити й надіслати',
      summaryEdit: 'Змінити дані',
      labels: {
        service: 'Послуга',
        breed: 'Порода',
        servicePrice: 'Вартість',
        date: 'Дата',
        time: 'Час привезення',
        name: 'Імʼя',
        email: 'Email',
        phone: 'Телефон',
        petName: 'Улюбленець',
        petSpecies: 'Вид тварини',
        petBreed: 'Порода улюбленця',
        petAge: 'Вік / дата народження',
        petSex: 'Стать улюбленця',
        petTag: 'Номер жетона',
        payment: 'Оплата',
        file: 'Файл',
        payNow: 'Онлайн-передоплата',
        payLater: 'Оплата в салоні',
        paySalonCash: 'Готівка в салоні',
        paySalonCard: 'Картка в салоні',
        payOnline: 'Онлайн-передоплата (Stripe)',
        noFile: 'Без файлу',
      },
      closeModal: 'Закрити вікно',
      datetimePickDate: 'Спочатку оберіть дату в календарі',
      datetimePickTime: 'Тепер оберіть зручний час привезення',
      datetimeDateChosen: 'Дату обрано',
    },
    en: {
      weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      services: ['Full dog grooming', 'Express deshedding', 'Hygiene care', 'Cat grooming', 'SPA care', 'Your suggestions'],
      fallbackService: 'Selected service',
      chooseService: 'Please select a service',
      chooseBreed: 'Choose your pet’s breed or category',
      serviceStep: '1. Breed and service',
      datetimeStep: '2. Date and arrival time',
      datetimeTitle: 'Choose a date and arrival time',
      breedLabel: 'Breed or category',
      serviceLabel: 'Available service',
      priceLabel: 'Estimated price',
      chooseBreedFirst: 'Choose a breed or pet category first',
      noServiceForBreed: 'No service is currently available for this breed.',
      chooseDate: 'Please select a date',
      chooseTime: 'Please select an arrival time',
      chooseContact: 'Please fill in name, email, and phone',
      petRegistration: {
        legend: 'Pet details for booking records',
        intro: 'These details are used for the salon’s private client and pet register and are not published on the website.',
        name: 'Pet name',
        species: 'Animal type',
        breed: 'Breed',
        age: 'Age or date of birth',
        sex: 'Sex',
        sexChoose: 'Not specified',
        female: 'Female',
        male: 'Male',
        tag: 'Tag number',
        speciesChoose: 'Choose animal type',
        auto: 'Detected automatically from the selected breed',
        dog: 'Dog',
        cat: 'Cat',
        smallAnimal: 'Small animal',
        rabbit: 'Rabbit',
        guineaPig: 'Guinea pig',
        other: 'Other',
      },
      choosePrivacy: 'Please confirm personal data processing consent',
      chooseAgb: 'Please confirm you have read the salon rules (AGB)',
      paymentRedirect: 'Redirecting to secure online payment…',
      paymentUnavailable:
        'Online payment is turned off for now. Please choose salon payment (cash or card).',
      paymentSuccess: 'Online deposit received. Your booking was sent to the salon.',
      dateInPast: 'Please choose a future date',
      fileType: 'Only JPG or PNG files are allowed',
      fileSize: 'File size must be up to 150 MB',
      fileUploadFailed: 'Photo upload failed. Try again or submit the booking without a file.',
      chooseFile: 'Choose file',
      noFileChosen: 'No file chosen',
      summaryTitle: 'Review your booking before sending',
      summaryConfirm: 'Confirm and send',
      summaryEdit: 'Edit details',
      labels: {
        service: 'Service',
        breed: 'Breed',
        servicePrice: 'Price',
        date: 'Date',
        time: 'Arrival time',
        name: 'Name',
        email: 'Email',
        phone: 'Phone',
        petName: 'Pet name',
        petSpecies: 'Animal type',
        petBreed: 'Pet breed',
        petAge: 'Age / date of birth',
        petSex: 'Pet sex',
        petTag: 'Tag number',
        payment: 'Payment',
        file: 'File',
        payNow: 'Pay now',
        payLater: 'Pay at salon',
        paySalonCash: 'Cash at the salon',
        paySalonCard: 'Card at the salon',
        payOnline: 'Online deposit (Stripe)',
        noFile: 'No file',
      },
      closeModal: 'Close dialog',
      datetimePickDate: 'Start by choosing a date in the calendar',
      datetimePickTime: 'Now pick a convenient arrival time',
      datetimeDateChosen: 'Date selected',
    },
    de: {
      weekdays: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
      services: ['Komplett-Grooming Hund', 'Express-Fellwechsel', 'Hygienepflege', 'Katzenpflege', 'SPA-Pflege', 'Ihre Vorschläge'],
      fallbackService: 'Ausgewählte Leistung',
      chooseService: 'Bitte wählen Sie eine Leistung',
      chooseBreed: 'Wählen Sie Rasse oder Tierkategorie',
      serviceStep: '1. Rasse und Leistung',
      datetimeStep: '2. Datum und Ankunftszeit',
      datetimeTitle: 'Datum und Ankunftszeit auswählen',
      breedLabel: 'Rasse oder Kategorie',
      serviceLabel: 'Passende Leistung',
      priceLabel: 'Richtpreis',
      chooseBreedFirst: 'Wählen Sie zuerst Rasse oder Tierkategorie',
      noServiceForBreed: 'Für diese Rasse ist derzeit keine passende Leistung verfügbar.',
      chooseDate: 'Bitte wählen Sie ein Datum',
      chooseTime: 'Bitte wählen Sie eine Ankunftszeit',
      chooseContact: 'Bitte füllen Sie Name, E-Mail und Telefon aus',
      petRegistration: {
        legend: 'Tierdaten für die Buchungsakte',
        intro: 'Diese Angaben werden im geschützten Kunden- und Tierregister des Salons gespeichert und nicht auf der Website veröffentlicht.',
        name: 'Name des Tieres',
        species: 'Tierart',
        breed: 'Rasse',
        age: 'Alter oder Geburtsdatum',
        sex: 'Geschlecht',
        sexChoose: 'Nicht angegeben',
        female: 'Weiblich',
        male: 'Männlich',
        tag: 'Markennummer',
        speciesChoose: 'Tierart auswählen',
        auto: 'Wird automatisch aus der gewählten Rasse erkannt',
        dog: 'Hund',
        cat: 'Katze',
        smallAnimal: 'Kleines Tier',
        rabbit: 'Kaninchen',
        guineaPig: 'Meerschweinchen',
        other: 'Andere',
      },
      choosePrivacy: 'Bitte bestätigen Sie die Verarbeitung personenbezogener Daten',
      chooseAgb: 'Bitte bestätigen Sie die Salonregeln (AGB)',
      paymentRedirect: 'Weiterleitung zur sicheren Online-Zahlung…',
      paymentUnavailable:
        'Online-Zahlung ist derzeit deaktiviert. Bitte Zahlung im Salon wählen (bar oder Karte).',
      paymentSuccess: 'Online-Anzahlung erhalten. Die Buchung wurde an den Salon gesendet.',
      dateInPast: 'Bitte wählen Sie ein zukünftiges Datum',
      fileType: 'Nur JPG- oder PNG-Dateien sind erlaubt',
      fileSize: 'Die Datei darf maximal 150 MB groß sein',
      fileUploadFailed: 'Foto-Upload fehlgeschlagen. Bitte erneut versuchen oder ohne Datei buchen.',
      chooseFile: 'Datei auswählen',
      noFileChosen: 'Keine Datei ausgewählt',
      summaryTitle: 'Bitte prüfen Sie Ihre Buchung vor dem Absenden',
      summaryConfirm: 'Bestätigen und senden',
      summaryEdit: 'Angaben ändern',
      labels: {
        service: 'Leistung',
        breed: 'Rasse',
        servicePrice: 'Preis',
        date: 'Datum',
        time: 'Ankunftszeit',
        name: 'Name',
        email: 'E-Mail',
        phone: 'Telefon',
        petName: 'Name des Tieres',
        petSpecies: 'Tierart',
        petBreed: 'Rasse des Tieres',
        petAge: 'Alter / Geburtsdatum',
        petSex: 'Geschlecht des Tieres',
        petTag: 'Markennummer',
        payment: 'Zahlung',
        file: 'Datei',
        payNow: 'Jetzt bezahlen',
        payLater: 'Zahlung im Salon',
        paySalonCash: 'Bar im Salon',
        paySalonCard: 'Karte im Salon',
        payOnline: 'Online-Anzahlung (Stripe)',
        noFile: 'Keine Datei',
      },
      closeModal: 'Dialog schließen',
      datetimePickDate: 'Wählen Sie zuerst ein Datum im Kalender',
      datetimePickTime: 'Wählen Sie nun eine passende Ankunftszeit',
      datetimeDateChosen: 'Datum gewählt',
    },
  };

  const bookingLocaleByLang = {
    ru: 'ru-RU',
    uk: 'uk-UA',
    en: 'en-GB',
    de: 'de-DE',
  };
  const bookingLocale = bookingLocaleByLang[pageLang] || bookingLocaleByLang.en;
  const bookingCopy = bookingCopyByLang[pageLang] || bookingCopyByLang.en;

  const bookingRiskCopyByLang = {
    ru: {
      clientTypeLabel: 'Статус клиента',
      clientTypePlaceholder: 'Выберите вариант',
      clientTypeNew: 'Первое посещение / новый клиент',
      clientTypeReturning: 'Постоянный клиент',
      coatLabel: 'Состояние шерсти',
      coatPlaceholder: 'Выберите состояние шерсти',
      coatGood: 'Хорошее состояние',
      coatSlightMats: 'Есть небольшие колтуны',
      coatManyMats: 'Много колтунов',
      coatSevereMatting: 'Сильное сваливание шерсти',
      behaviourLabel: 'Поведение питомца',
      behaviourPlaceholder: 'Выберите поведение',
      behaviourCalm: 'Спокойный',
      behaviourRestless: 'Беспокойный',
      behaviourVeryRestless: 'Очень беспокойный',
      behaviourAggressive: 'Может проявлять агрессию',
      riskHint: 'Эти ответы помогают заложить безопасный резерв времени. Они не фиксируют окончательную цену.',
      duration: minutes => {
        const hours = Math.floor(minutes / 60);
        const remainder = minutes % 60;
        const value = hours ? `${hours} ч${remainder ? ` ${remainder} мин` : ''}` : `${remainder} мин`;
        return `Ориентировочная длительность процедуры — ${value}.`;
      },
      endingHint: 'Точное время окончания зависит от состояния шерсти, поведения и фактического объёма работы.',
      availabilityLoading: 'Проверяем безопасные окна записи…',
      availabilityFallback: 'Показываем консервативные окна с резервом. Финальное подтверждение выполняет салон.',
      noSafeSlots: 'На эту дату нет безопасных окон. Выберите другую дату или отправьте запрос в салон.',
      requestNote: 'Это запрос на запись. Время привода фиксируется после проверки салоном.',
      labels: {
        clientType: 'Статус клиента',
        coatCondition: 'Состояние шерсти',
        behaviour: 'Поведение',
        duration: 'Ориентировочная длительность',
        buffer: 'Внутренний резерв',
        bookingMode: 'Режим подтверждения',
      },
      requested: 'Запрос на подтверждение',
      chooseField: field => `Выберите: ${field}`,
    },
    uk: {
      clientTypeLabel: 'Статус клієнта',
      clientTypePlaceholder: 'Оберіть варіант',
      clientTypeNew: 'Перший візит / новий клієнт',
      clientTypeReturning: 'Постійний клієнт',
      coatLabel: 'Стан шерсті',
      coatPlaceholder: 'Оберіть стан шерсті',
      coatGood: 'Добрий стан',
      coatSlightMats: 'Є невеликі ковтуни',
      coatManyMats: 'Багато ковтунів',
      coatSevereMatting: 'Сильне звалювання шерсті',
      behaviourLabel: 'Поведінка улюбленця',
      behaviourPlaceholder: 'Оберіть поведінку',
      behaviourCalm: 'Спокійний',
      behaviourRestless: 'Неспокійний',
      behaviourVeryRestless: 'Дуже неспокійний',
      behaviourAggressive: 'Може проявляти агресію',
      riskHint: 'Ці відповіді допомагають закласти безпечний резерв часу. Вони не фіксують остаточну вартість.',
      duration: minutes => {
        const hours = Math.floor(minutes / 60);
        const remainder = minutes % 60;
        const value = hours ? `${hours} год${remainder ? ` ${remainder} хв` : ''}` : `${remainder} хв`;
        return `Орієнтовна тривалість процедури — ${value}.`;
      },
      endingHint: 'Точний час завершення залежить від стану шерсті, поведінки та фактичного обсягу роботи.',
      availabilityLoading: 'Перевіряємо безпечні вікна запису…',
      availabilityFallback: 'Показуємо консервативні вікна з резервом. Остаточне підтвердження виконує салон.',
      noSafeSlots: 'На цю дату немає безпечних вікон. Оберіть іншу дату або надішліть запит до салону.',
      requestNote: 'Це запит на запис. Час привезення фіксується після перевірки салоном.',
      labels: {
        clientType: 'Статус клієнта',
        coatCondition: 'Стан шерсті',
        behaviour: 'Поведінка',
        duration: 'Орієнтовна тривалість',
        buffer: 'Внутрішній резерв',
        bookingMode: 'Режим підтвердження',
      },
      requested: 'Запит на підтвердження',
      chooseField: field => `Оберіть: ${field}`,
    },
    en: {
      clientTypeLabel: 'Client status',
      clientTypePlaceholder: 'Choose an option',
      clientTypeNew: 'First visit / new client',
      clientTypeReturning: 'Returning client',
      coatLabel: 'Coat condition',
      coatPlaceholder: 'Choose coat condition',
      coatGood: 'Good condition',
      coatSlightMats: 'A few small mats',
      coatManyMats: 'Many mats',
      coatSevereMatting: 'Severe matting',
      behaviourLabel: 'Pet behaviour',
      behaviourPlaceholder: 'Choose behaviour',
      behaviourCalm: 'Calm',
      behaviourRestless: 'Restless',
      behaviourVeryRestless: 'Very restless',
      behaviourAggressive: 'May show aggression',
      riskHint: 'These answers help us reserve safer working time. They do not fix the final price.',
      duration: minutes => {
        const hours = Math.floor(minutes / 60);
        const remainder = minutes % 60;
        const value = hours ? `${hours}h${remainder ? ` ${remainder} min` : ''}` : `${remainder} min`;
        return `Estimated procedure duration — ${value}.`;
      },
      endingHint: 'The exact finish time depends on coat condition, behaviour and the actual work required.',
      availabilityLoading: 'Checking safe booking windows…',
      availabilityFallback: 'Showing conservative windows with reserve time. The salon confirms the final booking.',
      noSafeSlots: 'There are no safe windows on this date. Choose another date or send a request to the salon.',
      requestNote: 'This is a booking request. The arrival time is confirmed after the salon reviews it.',
      labels: {
        clientType: 'Client status',
        coatCondition: 'Coat condition',
        behaviour: 'Behaviour',
        duration: 'Estimated duration',
        buffer: 'Internal reserve',
        bookingMode: 'Confirmation mode',
      },
      requested: 'Request for confirmation',
      chooseField: field => `Please choose: ${field}`,
    },
    de: {
      clientTypeLabel: 'Kundenstatus',
      clientTypePlaceholder: 'Option auswählen',
      clientTypeNew: 'Erstbesuch / neuer Kunde',
      clientTypeReturning: 'Stammkunde',
      coatLabel: 'Fellzustand',
      coatPlaceholder: 'Fellzustand auswählen',
      coatGood: 'Guter Zustand',
      coatSlightMats: 'Einige kleine Verfilzungen',
      coatManyMats: 'Viele Verfilzungen',
      coatSevereMatting: 'Stark verfilztes Fell',
      behaviourLabel: 'Verhalten des Tieres',
      behaviourPlaceholder: 'Verhalten auswählen',
      behaviourCalm: 'Ruhig',
      behaviourRestless: 'Unruhig',
      behaviourVeryRestless: 'Sehr unruhig',
      behaviourAggressive: 'Kann aggressiv reagieren',
      riskHint: 'Diese Angaben helfen uns, sichere Reservezeit einzuplanen. Sie legen den Endpreis nicht fest.',
      duration: minutes => {
        const hours = Math.floor(minutes / 60);
        const remainder = minutes % 60;
        const value = hours ? `${hours} Std.${remainder ? ` ${remainder} Min.` : ''}` : `${remainder} Min.`;
        return `Voraussichtliche Dauer — ${value}`;
      },
      endingHint: 'Die genaue Endzeit hängt von Fellzustand, Verhalten und dem tatsächlichen Arbeitsaufwand ab.',
      availabilityLoading: 'Sichere Terminfenster werden geprüft…',
      availabilityFallback: 'Konservative Zeitfenster mit Reserve werden angezeigt. Der Salon bestätigt den Termin endgültig.',
      noSafeSlots: 'Für diesen Tag gibt es keine sicheren Zeitfenster. Bitte wählen Sie ein anderes Datum oder senden Sie eine Anfrage.',
      requestNote: 'Dies ist eine Terminanfrage. Die Ankunftszeit wird nach Prüfung durch den Salon bestätigt.',
      labels: {
        clientType: 'Kundenstatus',
        coatCondition: 'Fellzustand',
        behaviour: 'Verhalten',
        duration: 'Voraussichtliche Dauer',
        buffer: 'Interne Reserve',
        bookingMode: 'Bestätigungsmodus',
      },
      requested: 'Anfrage zur Bestätigung',
      chooseField: field => `Bitte wählen: ${field}`,
    },
  };
  const bookingRiskCopy = bookingRiskCopyByLang[pageLang] || bookingRiskCopyByLang.en;

  const priceConfiguratorCopyByLang = {
    ru: {
      kicker: 'Прайс-консультант',
      title: 'Подберите услугу, породу и ориентировочную стоимость',
      lead:
        'Выберите формат ухода и породу или категорию питомца. Система покажет ориентировочную цену и краткое описание процедуры.',
      labels: {
        service: 'Услуга',
        option: 'Порода или категория',
        price: 'Ориентировочная цена',
        description: 'Описание',
        note: 'Важно',
        button: 'Записаться с этим вариантом',
        chooseService: 'Выберите услугу',
        chooseOption: 'Выберите породу или категорию',
        emptyTitle: 'Подберите подходящий вариант',
        emptyPrice: 'Стоимость появится после выбора услуги и породы.',
        tableService: 'Услуга / порода',
        tablePrice: 'Цена',
        mismatch: 'Для этой услуги выберите подходящую категорию питомца.',
      },
    },
    uk: {
      kicker: 'Прайс-консультант',
      title: 'Підберіть послугу, породу та орієнтовну вартість',
      lead:
        'Оберіть формат догляду та породу або категорію улюбленця. Система покаже орієнтовну ціну й короткий опис процедури.',
      labels: {
        service: 'Послуга',
        option: 'Порода або категорія',
        price: 'Орієнтовна ціна',
        description: 'Опис',
        note: 'Важливо',
        button: 'Записатися з цим варіантом',
        chooseService: 'Оберіть послугу',
        chooseOption: 'Оберіть породу або категорію',
        emptyTitle: 'Підберіть відповідний варіант',
        emptyPrice: 'Вартість з’явиться після вибору послуги та породи.',
        tableService: 'Послуга / порода',
        tablePrice: 'Ціна',
        mismatch: 'Для цієї послуги оберіть відповідну категорію улюбленця.',
      },
    },
    en: {
      kicker: 'Price assistant',
      title: 'Choose a service, breed and estimated price',
      lead:
        'Select the care format and your pet’s breed or category. The page will show an estimated price and a short description of the treatment.',
      labels: {
        service: 'Service',
        option: 'Breed or category',
        price: 'Estimated price',
        description: 'Description',
        note: 'Important',
        button: 'Book this option',
        chooseService: 'Choose a service',
        chooseOption: 'Choose a breed or category',
        emptyTitle: 'Find the right option',
        emptyPrice: 'The price will appear after you choose a service and breed.',
        tableService: 'Service / breed',
        tablePrice: 'Price',
        mismatch: 'Please choose a pet category that matches this service.',
      },
    },
    de: {
      kicker: 'Preisberater',
      title: 'Leistung, Rasse und Richtpreis auswählen',
      lead:
        'Wählen Sie die Pflegeart sowie Rasse oder Kategorie Ihres Tieres. Danach sehen Sie einen Richtpreis und eine kurze Leistungsbeschreibung.',
      labels: {
        service: 'Leistung',
        option: 'Rasse oder Kategorie',
        price: 'Richtpreis',
        description: 'Beschreibung',
        note: 'Wichtig',
        button: 'Diesen Termin anfragen',
        chooseService: 'Leistung wählen',
        chooseOption: 'Rasse oder Kategorie wählen',
        emptyTitle: 'Passende Variante auswählen',
        emptyPrice: 'Der Preis erscheint nach Auswahl von Leistung und Rasse.',
        tableService: 'Leistung / Rasse',
        tablePrice: 'Preis',
        mismatch: 'Bitte wählen Sie eine passende Tierkategorie für diese Leistung.',
      },
    },
  };
  const priceUiCopy = priceConfiguratorCopyByLang[pageLang] || priceConfiguratorCopyByLang.en;
  const priceCatalog = window.PriceCatalog?.build?.(pageLang) || window.PriceCatalog?.build?.('en');
  const setCurrencyText = (element, value) => {
    if (window.NikaCurrency?.setText) {
      window.NikaCurrency.setText(element, value);
      return;
    }
    if (element) element.textContent = value || '';
  };
  const priceCopy = {
    ...priceUiCopy,
    services: priceCatalog?.services || [],
    breedGroups: priceCatalog?.breedGroups || {},
    breedValue: priceCatalog?.breedValue,
    findBreed: priceCatalog?.findBreed,
    resolveQuote: priceCatalog?.resolveQuote,
  };
  const bookingCatalog = window.PriceBookingCatalog?.build?.(pageLang) || null;


  const injectHiddenValue = (form, name, value) => {
    let field = form.querySelector(`input[name="${name}"]`);

    if (!field) {
      field = document.createElement('input');
      field.type = 'hidden';
      field.name = name;
      form.prepend(field);
    }

    field.value = value;
  };

  const formCopy = {
    success: {
      ru: 'Сообщение отправлено! Мы свяжемся с вами в ближайшее время.',
      uk: "Повідомлення надіслано! Ми зв'яжемося з вами найближчим часом.",
      en: 'Message sent! We will get back to you soon.',
      de: 'Ihre Nachricht wurde gesendet! Wir melden uns in Kürze.',
    },
    error: {
      ru: 'Ошибка при отправке. Пожалуйста, позвоните нам по телефону.',
      uk: 'Помилка надсилання. Будь ласка, зателефонуйте нам.',
      en: 'Failed to send. Please contact us by phone.',
      de: 'Senden fehlgeschlagen. Bitte kontaktieren Sie uns telefonisch.',
    },
    sending: {
      ru: 'Отправляю...',
      uk: 'Надсилаю...',
      en: 'Sending...',
      de: 'Wird gesendet...',
    },
    localFunctionsRequired: {
      ru: url =>
        `Локальная страница открыта без серверной отправки. Откройте ${url} — там форма отправит заявку правильно.`,
      uk: url =>
        `Локальну сторінку відкрито без серверного надсилання. Відкрийте ${url} — там форма надішле заявку правильно.`,
      en: url =>
        `This local page is running without server sending. Open ${url} and the booking form will submit correctly.`,
      de: url =>
        `Diese lokale Seite läuft ohne Server-Versand. Öffnen Sie ${url}, dann sendet das Buchungsformular korrekt.`,
    },
  };

  const SENDMAIL_ENDPOINT_TIMEOUT_MS = 4500;

  const isPrivateLanHost = hostname =>
    /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(String(hostname || '').trim());

  const getLocalCloudflareSendmailUrl = () => {
    const { protocol, hostname, port } = window.location;
    const isLocalStaticHost =
      hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || isPrivateLanHost(hostname);
    const isStaticPreviewPort = ['5500', '5501', '5502', '5503', '5504'].includes(port);

    if (!isLocalStaticHost || !isStaticPreviewPort) {
      return '';
    }

    return `${protocol}//${hostname}:8788/sendmail`;
  };

  const getLocalCloudflarePageUrl = () => {
    const sendmailUrl = getLocalCloudflareSendmailUrl();
    if (!sendmailUrl) return '';

    const url = new URL(sendmailUrl);
    url.pathname = window.location.pathname;
    url.search = '';
    return url.toString();
  };

  const getSendmailEndpoints = () => {
    const endpoints = ['/sendmail'];
    const localCloudflareUrl = getLocalCloudflareSendmailUrl();

    if (localCloudflareUrl) {
      endpoints.push(localCloudflareUrl);
    }

    return endpoints;
  };

  const messageDraftCopy = {
    title: {
      ru: 'Помощник для текста',
      uk: 'Помічник для тексту',
      en: 'Text helper',
      de: 'Texthilfe',
    },
    button: {
      ru: 'Подготовить черновик',
      uk: 'Підготувати чернетку',
      en: 'Prepare draft',
      de: 'Entwurf vorbereiten',
    },
    loading: {
      ru: 'Готовлю черновик...',
      uk: 'Готую чернетку...',
      en: 'Preparing draft...',
      de: 'Entwurf wird erstellt...',
    },
    done: {
      ru: 'Черновик добавлен в поле сообщения.',
      uk: 'Чернетку додано до поля повідомлення.',
      en: 'Draft added to the message field.',
      de: 'Entwurf wurde in das Nachrichtenfeld eingefugt.',
    },
    failed: {
      ru: 'Не удалось создать черновик. Попробуйте снова чуть позже.',
      uk: 'Не вдалося створити чернетку. Спробуйте трохи пізніше.',
      en: 'Could not create draft. Please try again shortly.',
      de: 'Entwurf konnte nicht erstellt werden. Bitte versuchen Sie es erneut.',
    },
    localDevHint: {
      ru: 'Локальный запуск: откройте сайт через http://127.0.0.1:8788 (npm run dev:cf).',
      uk: 'Локальний запуск: відкрийте сайт через http://127.0.0.1:8788 (npm run dev:cf).',
      en: 'Local run: open the site via http://127.0.0.1:8788 (npm run dev:cf).',
      de: 'Lokaler Start: Bitte Seite uber http://127.0.0.1:8788 offnen (npm run dev:cf).',
    },
    apiKeyMissing: {
      ru: 'Сервис черновиков сейчас недоступен в локальном режиме.',
      uk: 'Сервіс чернеток зараз недоступний у локальному режимі.',
      en: 'Draft service is temporarily unavailable in local mode.',
      de: 'Der Entwurfsdienst ist lokal vorubergehend nicht verfugbar.',
    },
    authFailed: {
      ru: 'Сервис черновиков временно недоступен из-за ошибки авторизации.',
      uk: 'Сервіс чернеток тимчасово недоступний через помилку авторизації.',
      en: 'Draft service is temporarily unavailable due to authorization issues.',
      de: 'Der Entwurfsdienst ist vorübergehend wegen eines Autorisierungsfehlers nicht verfügbar.',
    },
  };

  const normalizeDraftMessage = value => {
    if (typeof value === 'string') return value.trim();
    if (Array.isArray(value)) {
      const joined = value
        .map(part => {
          if (typeof part === 'string') return part;
          if (part && typeof part === 'object' && typeof part.text === 'string') return part.text;
          return '';
        })
        .join('\n');
      return joined.trim();
    }
    return '';
  };

  const submitSendmailForm = async (form, submitBtn) => {
    const originalText = submitBtn?.textContent ?? '';

    form.querySelectorAll('.form-status').forEach(el => el.remove());

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = formCopy.sending[pageLang] ?? formCopy.sending.de;
    }

    const statusEl = document.createElement('p');
    statusEl.className = 'form-status';
    statusEl.setAttribute('role', 'status');
    statusEl.setAttribute('aria-live', 'polite');
    statusEl.setAttribute('tabindex', '-1');

    let shouldShowLocalFunctionHint = false;
    let lastResult = null;

    try {
      for (const endpoint of getSendmailEndpoints()) {
        let response;
        const controller = new window.AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), SENDMAIL_ENDPOINT_TIMEOUT_MS);

        try {
          response = await fetch(endpoint, {
            method: 'POST',
            body: new FormData(form),
            headers: { Accept: 'application/json' },
            signal: controller.signal,
          });
        } catch (error) {
          lastResult = { success: false, status: 0, error };
          shouldShowLocalFunctionHint = Boolean(getLocalCloudflareSendmailUrl());
          continue;
        } finally {
          window.clearTimeout(timeoutId);
        }

        const result = await response.json().catch(() => ({ success: false }));
        lastResult = { ...result, status: response.status };

        if (response.ok && result.success) {
          statusEl.classList.add('form-status--success');
          statusEl.textContent = result.message || (formCopy.success[pageLang] ?? formCopy.success.de);
          try {
            window.hundesalonTrackConversion?.({ currency: 'EUR' });
          } catch {
            /* ignore analytics errors */
          }
          const successValues = Object.fromEntries(new FormData(form).entries());
          form.reset();
          form.dispatchEvent(
            new CustomEvent('sendmail:success', {
              bubbles: true,
              detail: { values: successValues, message: statusEl.textContent, response: result },
            })
          );
          try {
            window.hundesalonTrackAdsConversion?.();
          } catch {
            /* non-blocking */
          }
          break;
        }

        if ((response.status === 404 || response.status === 405) && endpoint === '/sendmail') {
          shouldShowLocalFunctionHint = Boolean(getLocalCloudflareSendmailUrl());
          continue;
        }
      }
    } catch {
      lastResult = { success: false };
    } finally {
      if (!statusEl.classList.contains('form-status--success')) {
        const localCloudflarePageUrl = getLocalCloudflarePageUrl();
        statusEl.classList.add('form-status--error');
        statusEl.textContent =
          shouldShowLocalFunctionHint && localCloudflarePageUrl
            ? (formCopy.localFunctionsRequired[pageLang] ?? formCopy.localFunctionsRequired.de)(localCloudflarePageUrl)
            : lastResult?.message || (formCopy.error[pageLang] ?? formCopy.error.de);
      }

      form.appendChild(statusEl);
      window.requestAnimationFrame(() => statusEl.focus({ preventScroll: true }));

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }

    return statusEl.classList.contains('form-status--success');
  };

  const initSendmailForms = () => {
    const forms = document.querySelectorAll('form[action$="/sendmail"]');
    if (!forms.length) return;

    forms.forEach(form => {
      const ensureHiddenField = (name, value) => {
        let field = form.querySelector(`input[name="${name}"]`);
        if (!field) {
          field = document.createElement('input');
          field.type = 'hidden';
          field.name = name;
          form.appendChild(field);
        }
        field.value = value;
      };
      const ensureBookingPetRegistrationFields = () => {
        if (form.dataset.bookingPetRegistration === 'true') return;

        const copy = bookingCopy.petRegistration;
        if (!copy) return;

        const hasBookingCatalog = Boolean(bookingCatalog);
        const speciesFieldMarkup = hasBookingCatalog
          ? `
            <label class="booking-field-label booking-field-label--auto">
              <span>${copy.species}</span>
              <input type="hidden" name="pet_species" data-booking-pet-species />
              <input type="text" data-booking-pet-species-display readonly aria-readonly="true" />
              <small class="client-registration-form__required-hint">${copy.auto}</small>
            </label>`
          : `
            <label class="booking-field-label">
              <span>${copy.species}</span>
              <select name="pet_species" required>
                <option value="">${copy.speciesChoose}</option>
                <option value="dog">${copy.dog}</option>
                <option value="cat">${copy.cat}</option>
                <option value="small_animal">${copy.smallAnimal}</option>
                <option value="rabbit">${copy.rabbit}</option>
                <option value="guinea_pig">${copy.guineaPig}</option>
                <option value="other">${copy.other}</option>
              </select>
            </label>`;
        const breedFieldMarkup = hasBookingCatalog
          ? `
            <label class="booking-field-label booking-field-label--auto">
              <span>${copy.breed}</span>
              <input type="text" name="pet_breed" data-booking-pet-breed autocomplete="off" required readonly aria-readonly="true" />
              <small class="client-registration-form__required-hint">${copy.auto}</small>
            </label>`
          : `
            <label class="booking-field-label">
              <span>${copy.breed}</span>
              <input type="text" name="pet_breed" autocomplete="off" required />
            </label>`;

        const fieldset = document.createElement('fieldset');
        fieldset.className = 'booking-pet-registration client-registration-form__fieldset';
        fieldset.dataset.bookingPetRegistration = 'true';
        fieldset.innerHTML = `
          <legend>${copy.legend}</legend>
          <p class="booking-pet-registration__intro">${copy.intro}</p>
          <div class="client-registration-form__grid">
            <label class="booking-field-label">
              <span>${copy.name}</span>
              <input type="text" name="pet_name" autocomplete="off" required />
            </label>
            ${speciesFieldMarkup}
            ${breedFieldMarkup}
            <label class="booking-field-label">
              <span>${copy.age}</span>
              <input type="text" name="pet_age" autocomplete="off" />
            </label>
            <label class="booking-field-label">
              <span>${copy.sex}</span>
              <select name="pet_sex">
                <option value="">${copy.sexChoose}</option>
                <option value="female">${copy.female}</option>
                <option value="male">${copy.male}</option>
              </select>
            </label>
            <label class="booking-field-label">
              <span>${copy.tag}</span>
              <input type="text" name="pet_tag_number" inputmode="text" maxlength="60" />
            </label>
          </div>
        `;

        const messageField = form.querySelector('textarea[name="message"]');
        const messageGroup = messageField?.closest('.form-group, .client-registration-form__notes');
        if (messageGroup) {
          messageGroup.before(fieldset);
        } else {
          form.prepend(fieldset);
        }

        fieldset.querySelectorAll('select').forEach(select => window.refreshSiteSelect?.(select));
        form.dataset.bookingPetRegistration = 'true';
      };
      ensureHiddenField('lang', pageLang);
      ensureHiddenField('source', window.location.pathname);
      ensureHiddenField('source_form', form.id || form.getAttribute('name') || 'sendmail');
      if (form.id === 'booking-form') {
        ensureHiddenField('client_registration_id', '');
        ensureBookingPetRegistrationFields();
        return;
      }

      const isBookingForm =
        form.querySelector('input[name="service"][type="hidden"]') &&
        form.querySelector('input[name="date"][type="hidden"]') &&
        form.querySelector('input[name="time"][type="hidden"]');
      const isFeedbackForm =
        !isBookingForm &&
        (form.closest('.complaint-form') !== null || form.querySelector('select[name="subject"]') !== null);
      const declaredFormType = form.dataset.formType || form.querySelector('input[name="form_type"]')?.value || '';
      const formType = isBookingForm
        ? 'booking'
        : isFeedbackForm
          ? 'feedback'
          : declaredFormType === 'client_registration'
            ? 'client_registration'
            : 'contact';
      const messageField = form.querySelector('textarea[name="message"]');

      injectHiddenValue(form, 'lang', pageLang);
      injectHiddenValue(form, 'form_type', formType);

      if (formType === 'contact') {
        form.querySelector('input[name="name"]')?.setAttribute('required', '');
        form.querySelector('input[name="email"]')?.setAttribute('required', '');
        messageField?.setAttribute('required', '');
      }

      if (formType === 'feedback') {
        messageField?.setAttribute('required', '');
        form.querySelector('input[name="name"]')?.removeAttribute('required');
        form.querySelector('input[name="email"]')?.removeAttribute('required');
      }

      form.addEventListener('submit', async event => {
        event.preventDefault();
        const submitBtn = form.querySelector('[type="submit"]');
        await submitSendmailForm(form, submitBtn);
      });
    });
  };

  const initMessageDraftTools = () => {
    const resolveDraftEndpoints = () => {
      const port = window.location.port;

      if (port === '8788') {
        return ['/message-draft'];
      }

      return ['/message-draft', '/functions/message-draft'];
    };

    const requestMessageDraft = async requestBody => {
      let lastError = null;

      for (const endpoint of resolveDraftEndpoints()) {
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
            await response.text();
            if (response.status === 503) {
              throw new Error('DRAFT_SERVICE_UNCONFIGURED');
            }

            const error = new Error(`Draft request failed with status ${response.status} on ${endpoint}`);
            // Retry with next endpoint for infra-like failures.
            if (response.status === 404 || response.status === 405 || response.status >= 500) {
              lastError = error;
              continue;
            }
            throw error;
          }

          return await response.json();
        } catch (error) {
          lastError = error;
        }
      }

      const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const isStaticPreview = window.location.port === '5502';
      if (isLocalHost && isStaticPreview) {
        throw new Error('LOCAL_CF_DEV_REQUIRED');
      }

      throw lastError || new Error('Draft endpoints are unavailable');
    };

    const forms = document.querySelectorAll('form[action$="/sendmail"]');
    if (!forms.length) return;

    forms.forEach(form => {
      if (form.dataset.disableDraft === 'true') return;
      const messageField = form.querySelector('textarea[name="message"]');
      if (!messageField) return;
      if (form.dataset.messageDraftReady === 'true') return;
      form.dataset.messageDraftReady = 'true';

      const tools = document.createElement('div');
      tools.className = 'message-draft-tools';

      const title = document.createElement('span');
      title.className = 'message-draft-title';
      title.textContent = messageDraftCopy.title[pageLang] ?? messageDraftCopy.title.de;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'message-draft-btn';
      button.textContent = messageDraftCopy.button[pageLang] ?? messageDraftCopy.button.de;

      const status = document.createElement('p');
      status.className = 'message-draft-status';

      tools.appendChild(title);
      tools.appendChild(button);
      messageField.insertAdjacentElement('beforebegin', tools);
      messageField.insertAdjacentElement('afterend', status);

      button.addEventListener('click', async () => {
        const formType = form.querySelector('input[name="form_type"]')?.value || 'contact';
        const name = form.querySelector('input[name="name"]')?.value?.trim() || '';
        const service = form.querySelector('input[name="service"]')?.value?.trim() || '';
        const existingText = messageField.value.trim();

        status.className = 'message-draft-status message-draft-status--loading';
        status.textContent = messageDraftCopy.loading[pageLang] ?? messageDraftCopy.loading.de;
        button.disabled = true;

        try {
          const payload = await requestMessageDraft({
            temperature: 0.45,
            max_tokens: 260,
            messages: [
              {
                role: 'system',
                content:
                  'You write polite, concise salon customer messages in the requested language. Keep tone warm and practical. No markdown.',
              },
              {
                role: 'user',
                content: [
                  `Language: ${pageLang}`,
                  `Form type: ${formType}`,
                  `Customer name: ${name || 'not provided'}`,
                  `Service: ${service || 'not provided'}`,
                  `Existing message: ${existingText || 'empty'}`,
                  'Task: create a clear customer message draft for HUNDESALON NIKA contact form.',
                  'Output: plain text only, 70-120 words, with specific request details and preferred contact follow-up.',
                ].join('\n'),
              },
            ],
          });

          const draftText = normalizeDraftMessage(payload?.choices?.[0]?.message?.content);
          if (!draftText) {
            throw new Error('Draft response is empty');
          }

          messageField.value = draftText;
          status.className = 'message-draft-status message-draft-status--success';
          status.textContent = messageDraftCopy.done[pageLang] ?? messageDraftCopy.done.de;
        } catch (error) {
          status.className = 'message-draft-status message-draft-status--error';
          status.textContent =
            error?.message === 'LOCAL_CF_DEV_REQUIRED'
              ? (messageDraftCopy.localDevHint[pageLang] ?? messageDraftCopy.localDevHint.de)
              : error?.message === 'DRAFT_SERVICE_UNCONFIGURED'
                ? (messageDraftCopy.apiKeyMissing[pageLang] ?? messageDraftCopy.apiKeyMissing.de)
                : error?.message === 'SERVICE_GATEWAY_AUTH_FAILED'
                  ? (messageDraftCopy.authFailed[pageLang] ?? messageDraftCopy.authFailed.de)
                  : (messageDraftCopy.failed[pageLang] ?? messageDraftCopy.failed.de);
        } finally {
          button.disabled = false;
        }
      });
    });
  };

  const resolveHashTarget = hashHref => {
    if (!hashHref || hashHref === '#') return null;
    const rawId = hashHref.startsWith('#') ? hashHref.slice(1) : hashHref;
    if (!rawId || !/^[A-Za-z][\w-]*$/.test(rawId)) {
      return null;
    }
    return document.getElementById(rawId);
  };

  const initSmoothHashLinks = () => {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      const targetId = anchor.getAttribute('href');
      if (!targetId || targetId === '#') return;

      anchor.addEventListener('click', event => {
        const target = resolveHashTarget(targetId);
        if (!target) return;

        event.preventDefault();

        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        target.scrollIntoView({
          behavior: prefersReducedMotion ? 'auto' : 'smooth',
          block: 'start',
          inline: 'nearest',
        });

        if (scrollRoot) {
          window.requestAnimationFrame(() => {
            scrollRoot.dispatchEvent(new Event('scroll'));
          });
        }
      });
    });
  };

  const initBookingModal = () => {
    const modal = document.getElementById('booking-modal');
    if (!modal) return;

    if (modal.closest('.site-scroll-root')) {
      document.body.appendChild(modal);
    }

    const closeControl = modal.querySelector('.modal-close');
    const closeTriggers = modal.querySelectorAll('[data-booking-close]');
    const form = modal.querySelector('#booking-form');
    const serviceList = modal.querySelector('#service-list');
    const calendarContainer = modal.querySelector('#calendar-container');
    const timeSlotsContainer = modal.querySelector('#time-slots-container');
    const selectedServiceField = modal.querySelector('#selected-service');
    const selectedDateField = modal.querySelector('#selected-date');
    const selectedTimeField = modal.querySelector('#selected-time');
    const bookingFileInput = modal.querySelector('input[name="pet_photo"]');
    const bookingFileName = modal.querySelector('[data-booking-file-name]');
    const privacyInput = modal.querySelector('input[name="privacy_consent"]');
    const agbInput = modal.querySelector('input[name="agb_consent"]');
    const getPaymentChoice = () =>
      modal.querySelector('input[name="payment_choice"]:checked')?.value || 'salon_cash';
    const uploadedFileUrlField = modal.querySelector('input[name="uploaded_file_url"]');
    const bookingSummary = modal.querySelector('[data-booking-summary]');
    const bookingFilePreview = modal.querySelector('[data-booking-file-preview]');
    const steps = Array.from(modal.querySelectorAll('.step'));
    const panels = {
      1: modal.querySelector('#step-1'),
      2: modal.querySelector('#step-2'),
      3: modal.querySelector('#step-3'),
    };
    const nextStep1 = modal.querySelector('#next-step-1');
    const nextStep2 = modal.querySelector('#next-step-2');
    const prevStep2 = modal.querySelector('#prev-step-2');
    const prevStep3 = modal.querySelector('#prev-step-3');
    const openTriggers = document.querySelectorAll(
      '#open-booking-btn, .select-service-btn, .online-order-btn, [data-price-modal-booking]'
    );

    if (
      !form ||
      !serviceList ||
      !calendarContainer ||
      !timeSlotsContainer ||
      !selectedServiceField ||
      !selectedDateField ||
      !selectedTimeField
    ) {
      return;
    }

    if (bookingCatalog) {
      modal.querySelector('.step-indicator .step')?.replaceChildren(bookingCopy.serviceStep);
      panels[1]?.querySelector('h3')?.replaceChildren(bookingCopy.chooseBreed);
      modal.querySelector('.step-indicator .step:nth-child(2)')?.replaceChildren(bookingCopy.datetimeStep);
      panels[2]?.querySelector('h3')?.replaceChildren(bookingCopy.datetimeTitle);
    }

    const step2Panel = panels[2];
    const nativeFieldsGrid = modal.querySelector('[data-booking-native-fields]');
    let datetimeBody = step2Panel?.querySelector('.booking-datetime-body');
    let datetimeStatusEl = step2Panel?.querySelector('[data-booking-datetime-status]');
    let calendarBlockEl = step2Panel?.querySelector('.booking-datetime-block--calendar');
    let timeBlockEl = step2Panel?.querySelector('.booking-datetime-block--time');
    let choiceRowEl = step2Panel?.querySelector('[data-booking-datetime-choice]');
    let monthTitleEl = step2Panel?.querySelector('[data-booking-month-title]');
    let timeHintEl = step2Panel?.querySelector('[data-booking-time-hint]');
    let availabilityStatusEl = step2Panel?.querySelector('[data-booking-availability-status]');
    let choiceDateEl = step2Panel?.querySelector('[data-booking-choice-date]');
    let choiceTimeEl = step2Panel?.querySelector('[data-booking-choice-time]');

    const formatDisplayDate = isoDate => {
      if (!isoDate) {
        return '';
      }

      const [year, month, day] = isoDate.split('-').map(Number);
      return new Intl.DateTimeFormat(bookingLocale, {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(year, month - 1, day));
    };

    const formatMonthTitle = referenceDate => {
      return new Intl.DateTimeFormat(bookingLocale, {
        month: 'long',
        year: 'numeric',
      }).format(referenceDate);
    };

    const ensureDatetimeBlock = (className, kickerText, metaSelector) => {
      const blockSelector = `.${className.split(' ')[0]}`;
      let blockEl = step2Panel?.querySelector(blockSelector);

      if (!blockEl) {
        blockEl = document.createElement('section');
        blockEl.className = `booking-datetime-block ${className}`;
        blockEl.innerHTML = `
          <div class="booking-datetime-block__head">
            <span class="booking-datetime-block__kicker"></span>
            <span class="booking-datetime-block__meta" ${metaSelector}></span>
          </div>`;
        blockEl.querySelector('.booking-datetime-block__kicker').textContent = kickerText;
      }

      return blockEl;
    };

    const buildDatetimeStepLayout = () => {
      if (!step2Panel) {
        return;
      }

      const step2Buttons = step2Panel.querySelector('.modal-buttons');

      step2Panel.querySelector('[data-booking-datetime-summary]')?.remove();
      step2Panel.querySelectorAll('.booking-datetime-section').forEach(section => {
        if (calendarContainer.parentElement === section) {
          section.removeChild(calendarContainer);
        }

        if (timeSlotsContainer.parentElement === section) {
          section.removeChild(timeSlotsContainer);
        }

        section.remove();
      });
      step2Panel.querySelector('.booking-datetime-panels')?.remove();

      if (!datetimeBody) {
        datetimeBody = document.createElement('div');
        datetimeBody.className = 'booking-datetime-body';
        step2Panel.insertBefore(datetimeBody, step2Buttons);
      }

      if (!datetimeStatusEl) {
        datetimeStatusEl = document.createElement('div');
        datetimeStatusEl.className = 'booking-datetime-status';
        datetimeStatusEl.dataset.bookingDatetimeStatus = '';
        datetimeStatusEl.dataset.state = 'date';
      }

      calendarBlockEl = ensureDatetimeBlock(
        'booking-datetime-block--calendar',
        bookingCopy.labels.date,
        'data-booking-month-title'
      );
      monthTitleEl = calendarBlockEl.querySelector('[data-booking-month-title]');

      timeBlockEl = ensureDatetimeBlock(
        'booking-datetime-block--time is-awaiting-date',
        bookingCopy.labels.time,
        'data-booking-time-hint'
      );
      timeHintEl = timeBlockEl.querySelector('[data-booking-time-hint]');

      if (!availabilityStatusEl) {
        availabilityStatusEl = document.createElement('p');
        availabilityStatusEl.className = 'booking-availability-status';
        availabilityStatusEl.dataset.bookingAvailabilityStatus = '';
        availabilityStatusEl.setAttribute('aria-live', 'polite');
      }

      if (!choiceRowEl) {
        choiceRowEl = document.createElement('div');
        choiceRowEl.className = 'booking-datetime-choice';
        choiceRowEl.dataset.bookingDatetimeChoice = '';
        choiceRowEl.innerHTML = `
          <div class="booking-datetime-choice__item" data-booking-choice-item="date" data-filled="false">
            <span class="booking-datetime-choice__label"></span>
            <span class="booking-datetime-choice__value" data-booking-choice-date>—</span>
          </div>
          <div class="booking-datetime-choice__item" data-booking-choice-item="time" data-filled="false">
            <span class="booking-datetime-choice__label"></span>
            <span class="booking-datetime-choice__value" data-booking-choice-time>—</span>
          </div>`;
        choiceRowEl.querySelector('[data-booking-choice-item="date"] .booking-datetime-choice__label').textContent =
          bookingCopy.labels.date;
        choiceRowEl.querySelector('[data-booking-choice-item="time"] .booking-datetime-choice__label').textContent =
          bookingCopy.labels.time;
      }

      choiceDateEl = choiceRowEl.querySelector('[data-booking-choice-date]');
      choiceTimeEl = choiceRowEl.querySelector('[data-booking-choice-time]');

      calendarBlockEl.appendChild(calendarContainer);
      timeBlockEl.appendChild(timeSlotsContainer);
      timeBlockEl.appendChild(availabilityStatusEl);

      datetimeBody.append(datetimeStatusEl, calendarBlockEl, timeBlockEl, choiceRowEl);

      if (nativeFieldsGrid) {
        nativeFieldsGrid.classList.add('booking-native-grid--hidden');
        if (form && nativeFieldsGrid.parentElement !== form) {
          form.append(nativeFieldsGrid);
        }
      }
    };

    const updateDatetimeStepState = () => {
      const hasDate = Boolean(state.selectedDate);
      const hasTime = Boolean(state.selectedTime);
      const monthReference = hasDate
        ? (() => {
            const [year, month, day] = state.selectedDate.split('-').map(Number);
            return new Date(year, month - 1, day);
          })()
        : new Date();

      timeBlockEl?.classList.toggle('is-awaiting-date', !hasDate);
      timeBlockEl?.classList.toggle('is-ready', hasDate && !hasTime);
      timeBlockEl?.classList.toggle('is-complete', hasTime);

      timeSlotsContainer.classList.toggle('is-awaiting-date', !hasDate);
      timeSlotsContainer.classList.toggle('is-ready', hasDate && !hasTime);
      timeSlotsContainer.classList.toggle('is-complete', hasTime);

      if (datetimeStatusEl) {
        if (!hasDate) {
          datetimeStatusEl.textContent = bookingCopy.datetimePickDate;
          datetimeStatusEl.dataset.state = 'date';
        } else if (!hasTime) {
          datetimeStatusEl.textContent = `${bookingCopy.datetimeDateChosen}: ${formatDisplayDate(state.selectedDate)}`;
          datetimeStatusEl.dataset.state = 'time';
        } else {
          datetimeStatusEl.textContent = `${formatDisplayDate(state.selectedDate)} · ${state.selectedTime}`;
          datetimeStatusEl.dataset.state = 'ready';
        }
      }

      if (timeHintEl) {
        timeHintEl.textContent = hasDate ? bookingCopy.datetimePickTime : bookingCopy.datetimePickDate;
      }

      if (monthTitleEl) {
        monthTitleEl.textContent = formatMonthTitle(monthReference);
      }

      if (choiceDateEl) {
        choiceDateEl.textContent = hasDate ? formatDisplayDate(state.selectedDate) : '—';
        choiceDateEl.closest('[data-booking-choice-item]')?.setAttribute('data-filled', hasDate ? 'true' : 'false');
      }

      if (choiceTimeEl) {
        choiceTimeEl.textContent = hasTime ? state.selectedTime : '—';
        choiceTimeEl.closest('[data-booking-choice-item]')?.setAttribute('data-filled', hasTime ? 'true' : 'false');
      }

      if (selectedTimeField) {
        selectedTimeField.disabled = !hasDate;
        if (!hasDate) {
          selectedTimeField.value = '';
        }
      }

      window.requestAnimationFrame(refreshDatetimeScrollState);
    };

    buildDatetimeStepLayout();

    const bookingScrollbars = {
      services: null,
      calendarDays: null,
      timeSlots: null,
      form: null,
    };

    const bindBookingScrollbar = (scrollTarget, thumbParent = scrollTarget) => {
      const bind = window.HundesalonLiquidScrollbar?.bind;
      if (!bind || !scrollTarget || scrollTarget.dataset.customScrollbarBound === 'true') {
        return null;
      }

      scrollTarget.setAttribute('data-custom-scrollbar-host', '');

      return bind({
        scrollTarget,
        thumbParent,
        thumbClass: 'custom-scrollbar-thumb--panel',
        viewportPadding: 10,
        minHeight: 34,
      });
    };

    const getCalendarDaysScroll = () => calendarContainer?.querySelector('.calendar-days-scroll');

    const ensureBookingScrollbars = () => {
      if (!bookingScrollbars.services) {
        bookingScrollbars.services = bindBookingScrollbar(serviceList, serviceList);
      }

      const calendarDaysScroll = getCalendarDaysScroll();
      if (calendarDaysScroll && calendarDaysScroll.dataset.customScrollbarBound !== 'true') {
        bookingScrollbars.calendarDays = bindBookingScrollbar(
          calendarDaysScroll,
          calendarBlockEl || calendarDaysScroll
        );
      }

      if (timeSlotsContainer && timeSlotsContainer.dataset.customScrollbarBound !== 'true') {
        bookingScrollbars.timeSlots = bindBookingScrollbar(timeSlotsContainer, timeBlockEl || timeSlotsContainer);
      }

      const step3Form = panels[3]?.querySelector('form');
      if (step3Form && !bookingScrollbars.form && step3Form.dataset.customScrollbarBound !== 'true') {
        bookingScrollbars.form = bindBookingScrollbar(step3Form, step3Form);
      }
    };

    const refreshBookingScrollbars = () => {
      Object.values(bookingScrollbars).forEach(handle => {
        handle?.updateThumb?.();
      });
    };

    ensureBookingScrollbars();

    const stepIndicator = modal.querySelector('.step-indicator');
    const modalContent = modal.querySelector('.modal-content');
    const modalButtonRows = modal.querySelectorAll('.modal-buttons');
    const siteScrollRoot = document.querySelector('.site-scroll-root');
    let savedSiteScrollTop = 0;
    let wheelBlockHandler = null;
    let touchBlockHandler = null;
    let siteScrollRestoreHandler = null;
    const BOOKING_STEP_MOTION_MS = 420;
    let stepMotionTimer = null;
    let tiltResetTimer = null;

    const keepBookingModalViewportAtTop = () => {
      modalContent?.scrollTo?.({ top: 0, left: 0, behavior: 'auto' });
      if (siteScrollRoot) {
        siteScrollRoot.scrollTop = savedSiteScrollTop;
      }
    };

    modal.addEventListener('focusin', event => {
      if (event.target.closest('#booking-modal .calendar-day, #booking-modal .time-slot')) {
        window.requestAnimationFrame(keepBookingModalViewportAtTop);
      }
    });

    const ensureBookingGlassLayers = () => {
      if (!modalContent || modalContent.querySelector('.booking-glass-lens')) {
        return;
      }

      const lens = document.createElement('span');
      lens.className = 'booking-glass-lens booking-glass-layer';
      lens.setAttribute('aria-hidden', 'true');

      const caustic = document.createElement('span');
      caustic.className = 'booking-glass-caustic booking-glass-layer';
      caustic.setAttribute('aria-hidden', 'true');

      modalContent.insertBefore(caustic, modalContent.firstChild);
      modalContent.insertBefore(lens, modalContent.firstChild);
    };

    const resetBookingTilt = () => {
      modalContent?.style.setProperty('--booking-tilt-x', '0deg');
      modalContent?.style.setProperty('--booking-tilt-y', '0deg');
      modal.classList.remove('is-tilting');
    };

    const handleBookingPointerMove = event => {
      if (!modal.classList.contains('active') || !modalContent || modal.classList.contains('is-closing')) {
        return;
      }

      const rect = modalContent.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        return;
      }

      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;

      modal.classList.add('is-tilting');
      modalContent.style.setProperty('--booking-tilt-y', `${(x * 4.2).toFixed(2)}deg`);
      modalContent.style.setProperty('--booking-tilt-x', `${(-y * 3.1).toFixed(2)}deg`);

      if (tiltResetTimer) {
        window.clearTimeout(tiltResetTimer);
      }

      tiltResetTimer = window.setTimeout(() => {
        resetBookingTilt();
        tiltResetTimer = null;
      }, 900);
    };

    ensureBookingGlassLayers();

    if (window.matchMedia('(pointer: fine)').matches) {
      modal.addEventListener('pointermove', handleBookingPointerMove, { passive: true });
      modal.addEventListener('pointerleave', resetBookingTilt, { passive: true });
    }

    serviceList.classList.add('nav-main');
    timeSlotsContainer.classList.add('nav-main');
    stepIndicator?.classList.add('nav-main');
    modalButtonRows.forEach(row => row.classList.add('nav-main'));

    const sanitizeModalActionButtons = () => {
      modal.querySelectorAll('.modal-buttons .filter-btn').forEach(button => {
        button.classList.remove('online-order-pill', 'booking-modal-cta', 'active');
        button.removeAttribute('aria-current');
        button.setAttribute('aria-selected', 'false');
        button.querySelectorAll('.nav-plasma--active, .nav-plasma').forEach(layer => layer.remove());
        window.HundesalonNavPill?.deactivate?.(button);
        delete button.dataset.navPillBound;
      });
    };

    modal.querySelectorAll('.btn-modal:not(.btn-modal-primary)').forEach(button => {
      button.classList.add('filter-btn');
    });
    modal.querySelectorAll('.btn-modal-primary').forEach(button => {
      button.classList.remove('online-order-pill', 'booking-modal-cta');
      button.classList.add('filter-btn');
    });
    sanitizeModalActionButtons();

    document.querySelectorAll('.select-btn-wrapper').forEach(wrapper => {
      if (wrapper.closest('[data-price-configurator]')) {
        return;
      }

      wrapper.classList.add('nav-main');
      wrapper.querySelector('.select-service-btn')?.classList.add('filter-btn');
    });

    const scanBookingNavPills = (root = modal) => {
      window.HundesalonNavPill?.scan?.(root);
    };

    const clearBookingPillGroup = buttons => {
      buttons.forEach(button => {
        button.classList.remove('active', 'selected');
        button.setAttribute('aria-selected', 'false');
        button.removeAttribute('aria-current');
        window.HundesalonNavPill?.deactivate?.(button);
      });
    };

    const activateBookingPill = button => {
      if (!button) {
        return;
      }

      button.classList.add('active');
      button.classList.remove('selected');
      button.setAttribute('aria-selected', 'true');
      button.setAttribute('aria-current', 'true');
      window.HundesalonNavPill?.activate?.(button);
    };

    const refreshDatetimeScrollState = () => {
      if (!datetimeBody) {
        return;
      }

      datetimeBody.classList.remove('has-overflow', 'can-scroll-more');
    };

    const lockSiteScroll = () => {
      siteScrollRoot?.classList.add('booking-scroll-locked');
      document.documentElement.classList.add('booking-modal-open');
      document.body.classList.add('booking-modal-open');

      if (siteScrollRestoreHandler && siteScrollRoot) {
        siteScrollRoot.removeEventListener('scroll', siteScrollRestoreHandler);
      }

      siteScrollRestoreHandler = () => {
        if (modal.classList.contains('active') && siteScrollRoot && siteScrollRoot.scrollTop !== savedSiteScrollTop) {
          siteScrollRoot.scrollTop = savedSiteScrollTop;
        }
      };
      siteScrollRoot?.addEventListener('scroll', siteScrollRestoreHandler, { passive: true });

      const resolveBookingWheelScrollTarget = target => {
        const candidates = [
          target.closest('#booking-modal .calendar-days-scroll'),
          target.closest('#booking-modal #time-slots-container'),
          target.closest('#booking-modal .service-list'),
          target.closest('#booking-modal .booking-step.active'),
          target.closest('#booking-modal #booking-form'),
        ].filter(Boolean);

        return candidates.find(element => element.scrollHeight > element.clientHeight + 2) || null;
      };

      wheelBlockHandler = event => {
        if (!modal.classList.contains('active')) {
          return;
        }

        const scrollable = resolveBookingWheelScrollTarget(event.target);
        if (!scrollable) {
          event.preventDefault();
          return;
        }

        const maxScroll = scrollable.scrollHeight - scrollable.clientHeight;
        if (maxScroll <= 0) {
          event.preventDefault();
          return;
        }

        const nextScrollTop = Math.max(0, Math.min(maxScroll, scrollable.scrollTop + event.deltaY));
        scrollable.scrollTop = nextScrollTop;
        event.preventDefault();
      };

      touchBlockHandler = event => {
        if (!modal.classList.contains('active')) {
          return;
        }

        if (
          event.target.closest(
            '.calendar-days-scroll, #time-slots-container, .service-list, #booking-form, .modal-content'
          )
        ) {
          return;
        }

        event.preventDefault();
      };

      document.addEventListener('wheel', wheelBlockHandler, { passive: false, capture: true });
      document.addEventListener('touchmove', touchBlockHandler, { passive: false, capture: true });
    };

    const unlockSiteScroll = () => {
      if (siteScrollRestoreHandler && siteScrollRoot) {
        siteScrollRoot.removeEventListener('scroll', siteScrollRestoreHandler);
        siteScrollRestoreHandler = null;
      }

      siteScrollRoot?.classList.remove('booking-scroll-locked');
      if (siteScrollRoot) {
        siteScrollRoot.scrollTop = savedSiteScrollTop;
      }
      document.documentElement.classList.remove('booking-modal-open');
      document.body.classList.remove('booking-modal-open');

      if (wheelBlockHandler) {
        document.removeEventListener('wheel', wheelBlockHandler, { capture: true });
        wheelBlockHandler = null;
      }

      if (touchBlockHandler) {
        document.removeEventListener('touchmove', touchBlockHandler, { capture: true });
        touchBlockHandler = null;
      }
    };

    const updateStepTabs = () => {
      steps.forEach((item, index) => {
        const stepNumber = index + 1;
        const isActive = stepNumber === state.step;
        const isComplete = stepNumber < state.step;

        item.classList.toggle('is-complete', isComplete);
        item.setAttribute('aria-selected', isActive ? 'true' : 'false');
        item.setAttribute('tabindex', isActive ? '0' : '-1');

        if (isActive) {
          activateBookingPill(item);
        } else {
          item.classList.remove('active');
          item.removeAttribute('aria-current');
          window.HundesalonNavPill?.deactivate?.(item);
        }
      });
    };

    const navigateToStep = targetStep => {
      if (targetStep === state.step) {
        return;
      }

      if (targetStep < state.step) {
        setStep(targetStep);
        return;
      }

      if (targetStep === 2) {
        moveToDateStep();
        return;
      }

      if (targetStep === 3) {
        if (!state.selectedService) {
          setStep(1);
          showValidationMessage(
            bookingCopy.chooseService,
            serviceList.querySelector('[data-booking-service], .service-option')
          );
          return;
        }

        moveToContactStep();
      }
    };

    if (stepIndicator) {
      stepIndicator.setAttribute('role', 'tablist');
    }

    steps.forEach((stepEl, index) => {
      const stepNumber = index + 1;
      stepEl.classList.add('filter-btn');
      stepEl.setAttribute('role', 'tab');
      stepEl.dataset.bookingStep = String(stepNumber);

      if (stepEl.tagName !== 'BUTTON') {
        stepEl.setAttribute('tabindex', stepNumber === 1 ? '0' : '-1');
      }

      stepEl.addEventListener('click', () => navigateToStep(stepNumber));
      stepEl.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          navigateToStep(stepNumber);
        }
      });
    });

    timeSlotsContainer?.addEventListener('scroll', refreshDatetimeScrollState, { passive: true });
    window.addEventListener('resize', refreshDatetimeScrollState, { passive: true });

    // Add missing accessibility hooks without having to duplicate markup across all pages.
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-hidden', 'true');

    if (closeControl) {
      closeControl.setAttribute('aria-label', bookingCopy.closeModal);

      if (closeControl.tagName !== 'BUTTON') {
        closeControl.setAttribute('role', 'button');
        closeControl.setAttribute('tabindex', '0');
      }
    }

    const validationMessage = document.createElement('p');
    validationMessage.className = 'booking-validation-message';
    validationMessage.hidden = true;
    validationMessage.setAttribute('aria-live', 'assertive');
    validationMessage.setAttribute('aria-hidden', 'true');
    validationMessage.setAttribute('tabindex', '-1');
    form.prepend(validationMessage);

    const state = {
      step: 1,
      selectedService: selectedServiceField.value || '',
      selectedCategoryId: '',
      selectedBreedId: '',
      selectedServiceId: '',
      selectedPrice: '',
      selectedServiceLabel: '',
      selectedPriceOverride: '',
      selectedDate: selectedDateField.value || '',
      selectedTime: selectedTimeField.value || '',
      clientType: '',
      coatCondition: '',
      behavior: '',
      busyIntervals: [],
      availabilityConfigured: false,
      availabilityRequestId: 0,
      summaryConfirmed: false,
      uploadedFileUrl: uploadedFileUrlField?.value || '',
    };
    let lastFocusedElement = null;
    const formatDuration = minutes => {
      const safeMinutes = Math.max(0, Number(minutes) || 0);
      const hours = Math.floor(safeMinutes / 60);
      const remainder = safeMinutes % 60;
      if (pageLang === 'ru') return hours ? `${hours} ч${remainder ? ` ${remainder} мин` : ''}` : `${remainder} мин`;
      if (pageLang === 'uk') return hours ? `${hours} год${remainder ? ` ${remainder} хв` : ''}` : `${remainder} хв`;
      if (pageLang === 'de') return hours ? `${hours} Std.${remainder ? ` ${remainder} Min.` : ''}` : `${remainder} Min.`;
      return hours ? `${hours}h${remainder ? ` ${remainder} min` : ''}` : `${remainder} min`;
    };

    const getSelectedTiming = () => {
      if (bookingCatalog?.getTiming) {
        return bookingCatalog.getTiming({
          categoryId: state.selectedCategoryId,
          breedId: state.selectedBreedId,
          serviceId: state.selectedServiceId,
          clientType: state.clientType || 'new',
          coatCondition: state.coatCondition || 'good',
          behavior: state.behavior || 'calm',
        });
      }

      const standardMinutes = 120;
      const firstVisitExtraMinutes = state.clientType === 'returning' ? 0 : 60;
      const safeBlockMinutes = standardMinutes + firstVisitExtraMinutes + 30;
      return {
        standardMinutes,
        estimatedMinutes: standardMinutes + firstVisitExtraMinutes,
        bufferMinutes: 30,
        safeBlockMinutes,
        firstVisitExtraMinutes,
        coatExtraMinutes: 0,
        behaviourExtraMinutes: 0,
        sizeExtraMinutes: 0,
        slotStepMinutes: 30,
      };
    };

    const formatLocalDate = date => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const resolveBookingPetProfile = () => {
      const selectedBreed = bookingCatalog?.getBreed(state.selectedBreedId);
      const selectedCategory = bookingCatalog?.getCategory?.(state.selectedCategoryId);
      const source = [selectedCategory?.id, selectedCategory?.title, selectedBreed?.label]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase(bookingLocale);
      let key = 'dog';

      if (/guinea|морск|морські|meerschwein/u.test(source)) {
        key = 'guinea_pig';
      } else if (/rabbit|крол|kaninchen/u.test(source)) {
        key = 'rabbit';
      } else if (/small[-\s]?animals?|мелк|дрібн|kleintier|kleine tiere/u.test(source)) {
        key = 'small_animal';
      } else if (/\bcats?\b|кошк|кот|кіт|кішк|katze[n]?/u.test(source)) {
        key = 'cat';
      } else if (/important|важн|важл|wichtig/u.test(source)) {
        key = 'other';
      }

      const labels = {
        dog: bookingCopy.petRegistration.dog,
        cat: bookingCopy.petRegistration.cat,
        small_animal: bookingCopy.petRegistration.smallAnimal,
        rabbit: bookingCopy.petRegistration.rabbit,
        guinea_pig: bookingCopy.petRegistration.guineaPig,
        other: bookingCopy.petRegistration.other,
      };

      return {
        key,
        label: labels[key] || labels.other,
        breedLabel: selectedBreed?.label || '',
      };
    };

    const syncBookingPetProfile = () => {
      if (!bookingCatalog) return;

      const speciesField = form.querySelector('[data-booking-pet-species]');
      const speciesDisplay = form.querySelector('[data-booking-pet-species-display]');
      const breedField = form.querySelector('[data-booking-pet-breed]');
      if (!speciesField && !speciesDisplay && !breedField) return;

      const profile = resolveBookingPetProfile();
      if (speciesField) speciesField.value = profile.key;
      if (speciesDisplay) {
        speciesDisplay.value = profile.label;
        speciesDisplay.setAttribute('aria-label', `${bookingCopy.petRegistration.species}: ${profile.label}`);
      }
      if (breedField) {
        breedField.value = profile.breedLabel;
        if (profile.breedLabel) {
          breedField.readOnly = true;
          breedField.setAttribute('aria-readonly', 'true');
        } else {
          breedField.readOnly = false;
          breedField.removeAttribute('aria-readonly');
        }
      }
    };

    const syncHiddenFields = () => {
      syncBookingPetProfile();
      selectedServiceField.value = state.selectedService;
      selectedDateField.value = state.selectedDate;
      selectedTimeField.value = state.selectedTime;
      injectHiddenValue(form, 'breed', state.selectedBreedId);
      injectHiddenValue(form, 'service_category', state.selectedCategoryId);
      injectHiddenValue(form, 'service_price', state.selectedPrice);
      const timing = getSelectedTiming();
      injectHiddenValue(form, 'booking_client_type', state.clientType);
      injectHiddenValue(form, 'coat_condition', state.coatCondition);
      injectHiddenValue(form, 'behavior', state.behavior);
      injectHiddenValue(form, 'service_duration_minutes', timing.estimatedMinutes);
      injectHiddenValue(form, 'booking_buffer_minutes', timing.bufferMinutes);
      injectHiddenValue(form, 'booking_safe_block_minutes', timing.safeBlockMinutes);
      injectHiddenValue(form, 'booking_confirmation_status', 'requested');
      if (uploadedFileUrlField) {
        uploadedFileUrlField.value = state.uploadedFileUrl;
      }
    };

    const resetSummaryConfirmation = () => {
      state.summaryConfirmed = false;
      bookingSummary?.setAttribute('hidden', 'hidden');
      const submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn && submitBtn.dataset.originalText) {
        submitBtn.textContent = submitBtn.dataset.originalText;
      }
    };

    const clearValidationMessage = () => {
      validationMessage.textContent = '';
      validationMessage.hidden = true;
      validationMessage.classList.remove('is-visible');
      validationMessage.setAttribute('aria-hidden', 'true');
    };

    const showValidationMessage = (message, focusTarget) => {
      validationMessage.textContent = message;
      validationMessage.hidden = false;
      validationMessage.classList.add('is-visible');
      validationMessage.setAttribute('aria-hidden', 'false');

      window.requestAnimationFrame(() => {
        (focusTarget || validationMessage)?.focus?.({ preventScroll: true });
      });
    };

    const isFutureDate = value => {
      if (!value) {
        return false;
      }
      const selected = new Date(`${value}T00:00:00`);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return selected >= today;
    };

    const normalizeUploadedFileUrl = rawUrl => {
      try {
        const parsed = new URL(String(rawUrl || ''), window.location.origin);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return '';
        }
        // Same-origin upload proxy
        if (parsed.origin === window.location.origin && parsed.pathname.startsWith('/uploads/')) {
          return parsed.toString();
        }
        // Google Drive webViewLink from /upload (functions/upload.js)
        const host = parsed.hostname.replace(/^www\./, '');
        if (
          (host === 'drive.google.com' || host === 'docs.google.com') &&
          (parsed.pathname.includes('/file/') || parsed.pathname.includes('/open') || parsed.searchParams.has('id'))
        ) {
          return parsed.toString();
        }
        return '';
      } catch {
        return '';
      }
    };

    const validateBookingFile = () => {
      const file = bookingFileInput?.files?.[0];
      if (!file) {
        return true;
      }

      if (!PET_PHOTO_ALLOWED_TYPES.includes(file.type)) {
        showValidationMessage(bookingCopy.fileType, bookingFileInput);
        return false;
      }

      if (file.size > PET_PHOTO_MAX_BYTES) {
        showValidationMessage(bookingCopy.fileSize, bookingFileInput);
        return false;
      }

      return true;
    };

    const updateBookingFileName = () => {
      if (!bookingFileName) {
        return;
      }

      const file = bookingFileInput?.files?.[0];
      bookingFileName.textContent = file ? file.name : bookingCopy.noFileChosen;
    };

    const renderFilePreview = () => {
      if (!bookingFilePreview || !bookingFileInput) {
        return;
      }

      const file = bookingFileInput.files?.[0];
      if (!file) {
        bookingFilePreview.hidden = true;
        bookingFilePreview.replaceChildren();
        updateBookingFileName();
        return;
      }

      bookingFilePreview.hidden = false;
      bookingFilePreview.replaceChildren();
      const fileLabel = document.createElement('span');
      fileLabel.textContent = `${bookingCopy.labels.file}: ${file.name}`;
      bookingFilePreview.append(fileLabel);
      updateBookingFileName();
    };

    const uploadPetPhotoFile = async file => {
      const metadata = {
        lang: pageLang,
        service: state.selectedService,
        date: state.selectedDate,
        time: state.selectedTime,
      };

      if (file.size <= PET_PHOTO_PROXY_MAX_BYTES) {
        const uploadData = new FormData();
        uploadData.append('file', file);
        uploadData.append('lang', metadata.lang);
        uploadData.append('service', metadata.service);
        uploadData.append('date', metadata.date);
        uploadData.append('time', metadata.time);

        const response = await fetch('/upload', {
          method: 'POST',
          body: uploadData,
          headers: { Accept: 'application/json' },
        });
        return response.json().catch(() => ({}));
      }

      const sessionResponse = await fetch('/upload', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          intent: 'session',
          fileName: file.name,
          mimeType: file.type,
          size: file.size,
          ...metadata,
        }),
      });
      const session = await sessionResponse.json().catch(() => ({}));
      if (!sessionResponse.ok || !session.success) {
        return session;
      }
      if (session.configured === false) {
        return session;
      }
      if (!session.uploadUrl) {
        return { success: false };
      }

      const uploadResponse = await fetch(session.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!uploadResponse.ok) {
        return { success: false };
      }

      const driveFile = await uploadResponse.json().catch(() => ({}));
      const fileId = driveFile?.id || '';
      const fileUrl =
        driveFile?.webViewLink || (fileId ? `https://drive.google.com/file/d/${fileId}/view` : '');
      return { success: true, fileUrl, fileId };
    };

    const ensureBookingFileUploaded = async () => {
      const file = bookingFileInput?.files?.[0];
      if (!file || state.uploadedFileUrl) {
        return true;
      }

      try {
        const result = await uploadPetPhotoFile(file);
        const safeFileUrl = normalizeUploadedFileUrl(result.fileUrl);
        // Drive not configured: allow booking without link (server returns success + empty fileUrl)
        if (result.success && result.configured === false && !result.fileUrl) {
          return true;
        }
        if (result.success && safeFileUrl) {
          state.uploadedFileUrl = safeFileUrl;
          syncHiddenFields();
          if (bookingFilePreview) {
            bookingFilePreview.hidden = false;
            const fileUrlText = document.createElement('span');
            fileUrlText.textContent = safeFileUrl;
            bookingFilePreview.appendChild(fileUrlText);
          }
          return true;
        }
        showValidationMessage(bookingCopy.fileUploadFailed, bookingFileInput);
        return false;
      } catch {
        showValidationMessage(bookingCopy.fileUploadFailed, bookingFileInput);
        return false;
      }
    };

    const renderBookingSummary = ({ nameValue, emailValue, phoneValue }) => {
      if (!bookingSummary) {
        return;
      }

      const labels = bookingCopy.labels;
      const file = bookingFileInput?.files?.[0];
      const choice = getPaymentChoice();
      const paymentLabel =
        choice === 'online'
          ? labels.payOnline
          : choice === 'salon_card'
            ? labels.paySalonCard
            : labels.paySalonCash;
      const petSpeciesField = form.querySelector('[name="pet_species"]');
      const petSpeciesDisplay = form.querySelector('[data-booking-pet-species-display]');
      const petSpeciesValue =
        petSpeciesDisplay?.value?.trim() ||
        petSpeciesField?.selectedOptions?.[0]?.textContent?.trim() ||
        petSpeciesField?.value ||
        '';
      const petRows = [
        [labels.petName, form.querySelector('[name="pet_name"]')?.value?.trim()],
        [labels.petSpecies, petSpeciesValue],
        [labels.petBreed, form.querySelector('[name="pet_breed"]')?.value?.trim()],
        [labels.petAge, form.querySelector('[name="pet_age"]')?.value?.trim()],
        [labels.petSex, form.querySelector('[name="pet_sex"]')?.selectedOptions?.[0]?.textContent?.trim()],
        [labels.petTag, form.querySelector('[name="pet_tag_number"]')?.value?.trim()],
      ].filter(([, value]) => value);
      const selectedOptionText = selector =>
        serviceList.querySelector(`${selector} option:checked`)?.textContent?.trim() || '';
      const rows = [
        [labels.service, state.selectedService],
        ...(state.selectedBreedId && bookingCatalog
          ? [[labels.breed, bookingCatalog.getBreed(state.selectedBreedId)?.label || '—']]
          : []),
        ...(state.selectedPrice ? [[labels.servicePrice, state.selectedPrice]] : []),
        ...(bookingCatalog
          ? [
              [bookingRiskCopy.labels.clientType, selectedOptionText('[data-booking-client-type]')],
              [bookingRiskCopy.labels.coatCondition, selectedOptionText('[data-booking-coat-condition]')],
              [bookingRiskCopy.labels.behaviour, selectedOptionText('[data-booking-behavior]')],
              [bookingRiskCopy.labels.duration, formatDuration(getSelectedTiming().estimatedMinutes)],
              [bookingRiskCopy.labels.bookingMode, bookingRiskCopy.requested],
            ]
          : []),
        [labels.date, state.selectedDate],
        [labels.time, state.selectedTime],
        [labels.name, nameValue],
        [labels.email, emailValue],
        [labels.phone, phoneValue],
        ...petRows,
        [labels.payment, paymentLabel],
        [labels.file, state.uploadedFileUrl || file?.name || labels.noFile],
      ];

      bookingSummary.replaceChildren();
      const heading = document.createElement('h4');
      heading.textContent = bookingCopy.summaryTitle;
      const list = document.createElement('dl');
      for (const [label, value] of rows) {
        const term = document.createElement('dt');
        term.textContent = label;
        const definition = document.createElement('dd');
        setCurrencyText(definition, value || '—');
        list.append(term, definition);
      }
      bookingSummary.append(heading, list);
      bookingSummary.hidden = false;
    };

    const updateModalLayout = step => {
      modal.classList.remove('is-booking-step-1-active', 'is-booking-step-2-active', 'is-booking-step-3-active');
      modal.classList.add(`is-booking-step-${step}-active`);

      if (!modalContent) {
        return;
      }

      modalContent.classList.remove('is-booking-step-1', 'is-booking-step-2', 'is-booking-step-3');
      modalContent.classList.add(`is-booking-step-${step}`);
      stepIndicator?.style.setProperty('--booking-progress', String(step));
    };

    const resetStepScroll = step => {
      modalContent?.scrollTo?.({ top: 0, behavior: 'auto' });

      const activePanel = panels[step];
      activePanel?.scrollTo?.({ top: 0, behavior: 'auto' });
      activePanel?.querySelector('.calendar-days-scroll')?.scrollTo?.({ top: 0, behavior: 'auto' });
      activePanel?.querySelector('#time-slots-container')?.scrollTo?.({ top: 0, behavior: 'auto' });
      activePanel?.querySelector('.service-list, form')?.scrollTo?.({
        top: 0,
        behavior: 'auto',
      });
    };

    const setStep = step => {
      const prevStep = state.step;
      state.step = step;
      clearValidationMessage();

      if (stepMotionTimer) {
        window.clearTimeout(stepMotionTimer);
        stepMotionTimer = null;
      }

      modal.classList.remove('is-step-forward', 'is-step-back');
      if (step !== prevStep) {
        modal.classList.add(step > prevStep ? 'is-step-forward' : 'is-step-back');
        stepMotionTimer = window.setTimeout(() => {
          modal.classList.remove('is-step-forward', 'is-step-back');
          stepMotionTimer = null;
        }, BOOKING_STEP_MOTION_MS);
      }

      Object.entries(panels).forEach(([key, panel]) => {
        panel?.classList.toggle('active', Number(key) === step);
      });

      steps.forEach((item, index) => {
        item.classList.toggle('active', index + 1 === step);
      });

      updateStepTabs();
      updateModalLayout(step);

      if (step === 3) {
        syncBookingPetProfile();
      }

      if (step === 2) {
        renderCalendar();
        renderTimeSlots();
        updateDatetimeStepState();
        if (state.selectedDate) {
          loadDateAvailability(state.selectedDate);
        }
      }

      window.requestAnimationFrame(() => {
        resetStepScroll(step);
        keepBookingModalViewportAtTop();
        refreshDatetimeScrollState();
        ensureBookingScrollbars();
        refreshBookingScrollbars();
        sanitizeModalActionButtons();
        scanBookingNavPills(modal);
      });
    };

    const renderServiceList = () => {
      serviceList.innerHTML = '';

      if (!bookingCatalog) {
        const services =
          bookingCopy.services.includes(state.selectedService) || !state.selectedService
            ? bookingCopy.services
            : [state.selectedService, ...bookingCopy.services];
        const serviceButtons = [];

        services.forEach((serviceName, index) => {
          const button = document.createElement('button');
          const isActive = state.selectedService === serviceName;
          button.type = 'button';
          button.className = 'filter-btn service-option';
          button.textContent = serviceName;
          button.style.setProperty('--service-i', String(index));
          button.setAttribute('role', 'tab');
          button.setAttribute('aria-selected', isActive ? 'true' : 'false');
          if (isActive) {
            button.classList.add('active');
            button.setAttribute('aria-current', 'true');
          }
          button.addEventListener('click', () => {
            if (button.classList.contains('active')) return;
            clearBookingPillGroup(serviceButtons);
            activateBookingPill(button);
            state.selectedService = serviceName;
            state.selectedPrice = '';
            syncHiddenFields();
            resetSummaryConfirmation();
            clearValidationMessage();
          });
          serviceButtons.push(button);
          serviceList.appendChild(button);
        });
        scanBookingNavPills(serviceList);
        serviceButtons.filter(button => button.classList.contains('active')).forEach(activateBookingPill);
        return;
      }

      const selection = document.createElement('div');
      selection.className = 'booking-selection';
      selection.innerHTML = `
        <p class="booking-selection__intro">${bookingCopy.chooseBreed}</p>
        <label class="booking-selection__field">
          <span>${bookingCopy.breedLabel}</span>
          <select data-booking-breed required></select>
        </label>
        <label class="booking-selection__field">
          <span>${bookingCopy.serviceLabel}</span>
          <select data-booking-service required disabled></select>
        </label>
        <div class="booking-selection__price" data-booking-price aria-live="polite">
          ${bookingCopy.chooseBreedFirst}
        </div>
        <fieldset class="booking-selection__risk" data-booking-risk>
          <legend>${bookingRiskCopy.clientTypeLabel}</legend>
          <label class="booking-selection__field">
            <span>${bookingRiskCopy.clientTypeLabel}</span>
            <select data-booking-client-type required>
              <option value="">${bookingRiskCopy.clientTypePlaceholder}</option>
              <option value="new">${bookingRiskCopy.clientTypeNew}</option>
              <option value="returning">${bookingRiskCopy.clientTypeReturning}</option>
            </select>
          </label>
          <label class="booking-selection__field">
            <span>${bookingRiskCopy.coatLabel}</span>
            <select data-booking-coat-condition required>
              <option value="">${bookingRiskCopy.coatPlaceholder}</option>
              <option value="good">${bookingRiskCopy.coatGood}</option>
              <option value="slight_mats">${bookingRiskCopy.coatSlightMats}</option>
              <option value="many_mats">${bookingRiskCopy.coatManyMats}</option>
              <option value="severe_matting">${bookingRiskCopy.coatSevereMatting}</option>
            </select>
          </label>
          <label class="booking-selection__field">
            <span>${bookingRiskCopy.behaviourLabel}</span>
            <select data-booking-behavior required>
              <option value="">${bookingRiskCopy.behaviourPlaceholder}</option>
              <option value="calm">${bookingRiskCopy.behaviourCalm}</option>
              <option value="restless">${bookingRiskCopy.behaviourRestless}</option>
              <option value="very_restless">${bookingRiskCopy.behaviourVeryRestless}</option>
              <option value="aggressive">${bookingRiskCopy.behaviourAggressive}</option>
            </select>
          </label>
          <p class="booking-selection__risk-hint">${bookingRiskCopy.riskHint}</p>
        </fieldset>
        <div class="booking-selection__timing" data-booking-timing aria-live="polite"></div>
      `;

      const breedSelect = selection.querySelector('[data-booking-breed]');
      const serviceSelect = selection.querySelector('[data-booking-service]');
      const priceOutput = selection.querySelector('[data-booking-price]');
      const clientTypeSelect = selection.querySelector('[data-booking-client-type]');
      const coatConditionSelect = selection.querySelector('[data-booking-coat-condition]');
      const behaviorSelect = selection.querySelector('[data-booking-behavior]');
      const timingOutput = selection.querySelector('[data-booking-timing]');
      const allBreeds = bookingCatalog.categories.flatMap(category =>
        category.breeds.map(breed => ({ ...breed, categoryTitle: category.title }))
      );

      const renderTimingPreview = () => {
        const timing = getSelectedTiming();
        if (!state.selectedServiceId || !state.clientType || !state.coatCondition || !state.behavior) {
          timingOutput.textContent = bookingRiskCopy.requestNote;
          return;
        }

        timingOutput.replaceChildren();
        const duration = document.createElement('strong');
        duration.textContent = bookingRiskCopy.duration(timing.estimatedMinutes);
        const ending = document.createElement('span');
        ending.textContent = ` ${bookingRiskCopy.endingHint}`;
        timingOutput.append(duration, ending);
      };

      const syncRiskSelection = () => {
        state.clientType = clientTypeSelect?.value || '';
        state.coatCondition = coatConditionSelect?.value || '';
        state.behavior = behaviorSelect?.value || '';
        syncHiddenFields();
        renderTimingPreview();
        resetSummaryConfirmation();
        clearValidationMessage();
        if (state.selectedDate) {
          state.busyIntervals = [];
          state.availabilityConfigured = false;
          renderTimeSlots();
          loadDateAvailability(state.selectedDate);
        }
      };

      bookingCatalog.categories.forEach(category => {
        if (!category.breeds.length) return;
        const group = document.createElement('optgroup');
        group.label = category.title;
        category.breeds.forEach(breed => {
          const option = document.createElement('option');
          option.value = breed.id;
          option.textContent = breed.label;
          group.appendChild(option);
        });
        breedSelect.appendChild(group);
      });

      const updateSelection = () => {
        const selectedBreed = bookingCatalog.getBreed(breedSelect.value);
        if (!selectedBreed) {
          serviceSelect.replaceChildren();
          serviceSelect.disabled = true;
          setCurrencyText(priceOutput, bookingCopy.chooseBreedFirst);
          state.selectedCategoryId = '';
          state.selectedBreedId = '';
          state.selectedServiceId = '';
          state.selectedService = '';
          state.selectedPrice = '';
          state.selectedServiceLabel = '';
          state.selectedPriceOverride = '';
          syncHiddenFields();
          renderTimingPreview();
          return;
        }

        state.selectedCategoryId = selectedBreed.categoryId;
        state.selectedBreedId = selectedBreed.id;
        const services = bookingCatalog.getServices(selectedBreed.categoryId, selectedBreed.id);
        serviceSelect.replaceChildren();
        services.forEach(service => {
          const option = document.createElement('option');
          option.value = service.id;
          option.textContent = service.label;
          serviceSelect.appendChild(option);
        });
        serviceSelect.disabled = services.length === 0;

        const selectedServiceId = services.some(service => service.id === state.selectedServiceId)
          ? state.selectedServiceId
          : services[0]?.id || '';
        serviceSelect.value = selectedServiceId;
        state.selectedServiceId = selectedServiceId;

        const quote = bookingCatalog.resolveQuote(
          state.selectedCategoryId,
          state.selectedBreedId,
          state.selectedServiceId
        );
        state.selectedService = state.selectedServiceLabel || quote.label;
        state.selectedPrice = state.selectedPriceOverride || quote.price;
        const displayedPrice = state.selectedPriceOverride || quote.price;
        setCurrencyText(
          priceOutput,
          displayedPrice ? `${bookingCopy.priceLabel}: ${displayedPrice}` : bookingCopy.noServiceForBreed
        );
        syncHiddenFields();
        renderTimingPreview();
      };

      const initialBreed = allBreeds.some(breed => breed.id === state.selectedBreedId)
        ? state.selectedBreedId
        : allBreeds[0]?.id || '';
      breedSelect.value = initialBreed;
      clientTypeSelect.value = state.clientType;
      coatConditionSelect.value = state.coatCondition;
      behaviorSelect.value = state.behavior;
      breedSelect.addEventListener('change', () => {
        state.selectedServiceId = '';
        state.selectedServiceLabel = '';
        state.selectedPriceOverride = '';
        updateSelection();
        resetSummaryConfirmation();
        clearValidationMessage();
        if (state.selectedDate) renderTimeSlots();
      });
      serviceSelect.addEventListener('change', () => {
        state.selectedServiceId = serviceSelect.value;
        state.selectedServiceLabel = '';
        state.selectedPriceOverride = '';
        updateSelection();
        resetSummaryConfirmation();
        clearValidationMessage();
        if (state.selectedDate) renderTimeSlots();
      });
      [clientTypeSelect, coatConditionSelect, behaviorSelect].forEach(select => {
        select?.addEventListener('change', syncRiskSelection);
      });

      serviceList.appendChild(selection);
      updateSelection();
    };

    const setAvailabilityStatus = (message, stateName = '') => {
      if (!availabilityStatusEl) return;
      availabilityStatusEl.textContent = message;
      availabilityStatusEl.dataset.state = stateName;
      availabilityStatusEl.hidden = !message;
    };

    const loadDateAvailability = async date => {
      if (!date) return;

      const requestId = ++state.availabilityRequestId;
      state.busyIntervals = [];
      state.availabilityConfigured = false;
      setAvailabilityStatus(bookingRiskCopy.availabilityLoading, 'loading');
      renderTimeSlots();

      try {
        const response = await fetch(`/booking-availability?date=${encodeURIComponent(date)}`, {
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success || requestId !== state.availabilityRequestId) {
          throw new Error('Availability lookup unavailable');
        }

        state.busyIntervals = Array.isArray(result.busyIntervals) ? result.busyIntervals : [];
        state.availabilityConfigured = Boolean(result.configured);
        setAvailabilityStatus(
          state.availabilityConfigured ? bookingRiskCopy.requestNote : bookingRiskCopy.availabilityFallback,
          state.availabilityConfigured ? 'configured' : 'fallback'
        );
        renderTimeSlots();
      } catch {
        if (requestId !== state.availabilityRequestId) return;
        state.busyIntervals = [];
        state.availabilityConfigured = false;
        setAvailabilityStatus(bookingRiskCopy.availabilityFallback, 'fallback');
        renderTimeSlots();
      }
    };

    const renderCalendar = () => {
      const today = new Date();
      const normalizedToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      let startDayOfWeek = firstDay.getDay();
      let dayNumber = 1;

      if (startDayOfWeek === 0) {
        startDayOfWeek = 7;
      }

      let weekdaysRow = calendarContainer.querySelector('.calendar-weekdays');
      let daysScroll = calendarContainer.querySelector('.calendar-days-scroll');

      if (!weekdaysRow) {
        weekdaysRow = document.createElement('div');
        weekdaysRow.className = 'calendar-weekdays';
        bookingCopy.weekdays.forEach(weekday => {
          const cell = document.createElement('div');
          cell.className = 'calendar-weekday';
          cell.textContent = weekday;
          weekdaysRow.appendChild(cell);
        });
      }

      if (!daysScroll) {
        daysScroll = document.createElement('div');
        daysScroll.className = 'calendar-days-scroll';
        daysScroll.addEventListener('scroll', refreshDatetimeScrollState, { passive: true });
        calendarContainer.append(weekdaysRow, daysScroll);
      }

      const calendar = document.createElement('div');
      calendar.className = 'calendar calendar-days nav-main';
      const dayButtons = [];

      const leadingBlanks = startDayOfWeek - 1;
      const daysInMonth = lastDay.getDate();
      const cellCount = Math.ceil((leadingBlanks + daysInMonth) / 7) * 7;

      for (let index = 0; index < cellCount; index += 1) {
        const cell = document.createElement('button');
        cell.type = 'button';

        if (index < leadingBlanks || dayNumber > daysInMonth) {
          cell.className = 'calendar-day is-empty';
          cell.setAttribute('tabindex', '-1');
          cell.setAttribute('aria-hidden', 'true');
          calendar.appendChild(cell);
          continue;
        }

        const date = new Date(today.getFullYear(), today.getMonth(), dayNumber);
        const isoDate = formatLocalDate(date);
        const isPastDay = date < normalizedToday;
        const isActive = state.selectedDate === isoDate;

        cell.className = 'filter-btn calendar-day';
        cell.textContent = String(dayNumber);
        cell.style.setProperty('--calendar-i', String(dayNumber));
        cell.dataset.date = isoDate;
        cell.setAttribute('role', 'tab');
        cell.setAttribute('aria-selected', isActive ? 'true' : 'false');
        if (isActive) {
          cell.classList.add('active');
          cell.setAttribute('aria-current', 'true');
        }

        if (isPastDay) {
          cell.classList.add('is-disabled');
          cell.disabled = true;
        } else {
          cell.addEventListener('click', () => {
            if (cell.classList.contains('active')) {
              return;
            }

            clearBookingPillGroup(dayButtons);
            activateBookingPill(cell);
            state.selectedDate = isoDate;
            state.selectedTime = '';
            state.busyIntervals = [];
            state.availabilityConfigured = false;
            syncHiddenFields();
            resetSummaryConfirmation();
            clearValidationMessage();
            renderTimeSlots();
            updateDatetimeStepState();
            loadDateAvailability(isoDate);
          });
          dayButtons.push(cell);
        }

        calendar.appendChild(cell);
        dayNumber += 1;
      }

      daysScroll.replaceChildren(calendar);
      ensureBookingScrollbars();
      scanBookingNavPills(calendar);
      dayButtons.filter(button => button.classList.contains('active')).forEach(activateBookingPill);
      updateDatetimeStepState();
      window.requestAnimationFrame(refreshBookingScrollbars);
    };

    const renderTimeSlots = () => {
      const timing = getSelectedTiming();
      const timeSlots = bookingCatalog?.getAvailableStartTimes
        ? bookingCatalog.getAvailableStartTimes(state.selectedDate, timing, state.busyIntervals, {
            calendarConfigured: state.availabilityConfigured,
          })
        : ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];
      timeSlotsContainer.innerHTML = '';
      const slotButtons = [];

      if (!timeSlots.length) {
        const emptyState = document.createElement('p');
        emptyState.className = 'booking-time-slots-empty';
        emptyState.textContent = state.selectedDate ? bookingRiskCopy.noSafeSlots : bookingCopy.datetimePickDate;
        timeSlotsContainer.appendChild(emptyState);
        if (availabilityStatusEl?.dataset.state !== 'loading') {
          setAvailabilityStatus(state.selectedDate ? bookingRiskCopy.noSafeSlots : '', state.selectedDate ? 'empty' : '');
        }
        updateDatetimeStepState();
        window.requestAnimationFrame(refreshBookingScrollbars);
        return;
      }

      timeSlots.forEach((time, index) => {
        const button = document.createElement('button');
        const isActive = state.selectedTime === time;

        button.type = 'button';
        button.className = 'filter-btn time-slot';
        button.textContent = time;
        button.style.setProperty('--slot-i', String(index));
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', isActive ? 'true' : 'false');
        if (isActive) {
          button.classList.add('active');
          button.setAttribute('aria-current', 'true');
        }

        button.addEventListener('click', () => {
          if (button.classList.contains('active')) {
            return;
          }

          clearBookingPillGroup(slotButtons);
          activateBookingPill(button);
          state.selectedTime = time;
          syncHiddenFields();
          resetSummaryConfirmation();
          clearValidationMessage();
          updateDatetimeStepState();
        });

        slotButtons.push(button);
        timeSlotsContainer.appendChild(button);
      });

      scanBookingNavPills(timeSlotsContainer);
      slotButtons.filter(button => button.classList.contains('active')).forEach(activateBookingPill);
      updateDatetimeStepState();
      window.requestAnimationFrame(refreshBookingScrollbars);
    };

    const bindNativeBookingFields = () => {
      const today = formatLocalDate(new Date());
      selectedDateField.setAttribute('min', today);
      selectedTimeField.setAttribute('min', '09:00');
      selectedTimeField.setAttribute('max', '19:00');

      selectedDateField.addEventListener('change', () => {
        state.selectedDate = selectedDateField.value;
        state.selectedTime = '';
        state.busyIntervals = [];
        state.availabilityConfigured = false;
        resetSummaryConfirmation();
        clearValidationMessage();
        renderCalendar();
        renderTimeSlots();
        if (state.selectedDate) loadDateAvailability(state.selectedDate);
      });

      selectedTimeField.addEventListener('change', () => {
        state.selectedTime = selectedTimeField.value;
        resetSummaryConfirmation();
        clearValidationMessage();
        renderTimeSlots();
      });

      form.querySelectorAll('input, textarea, select').forEach(control => {
        control.addEventListener('input', resetSummaryConfirmation);
        control.addEventListener('change', resetSummaryConfirmation);
      });

      bookingFileInput?.addEventListener('change', () => {
        state.uploadedFileUrl = '';
        syncHiddenFields();
        resetSummaryConfirmation();
        clearValidationMessage();
        if (validateBookingFile()) {
          renderFilePreview();
        } else {
          updateBookingFileName();
        }
      });

      updateBookingFileName();
    };

    const resolveServiceFromTrigger = trigger => {
      const wrapper = trigger.closest('.select-btn-wrapper');
      const fromData = wrapper?.dataset.service?.trim();

      if (fromData) return fromData;

      const rowLabel = wrapper?.previousElementSibling?.querySelector('tbody tr td:first-child')?.textContent?.trim();
      return rowLabel || bookingCopy.fallbackService;
    };

    const resolveBookingPreset = trigger => ({
      serviceName: trigger.dataset.bookingServiceLabel || (trigger.id === 'open-booking-btn' ? '' : resolveServiceFromTrigger(trigger)),
      categoryId: trigger.dataset.bookingCategory || '',
      breedId: trigger.dataset.bookingBreed || '',
      serviceId: trigger.dataset.bookingService || '',
      price: trigger.dataset.bookingPrice || '',
      serviceLabel: trigger.dataset.bookingServiceLabel || '',
      priceOverride: trigger.dataset.bookingPrice || '',
    });

    const BOOKING_MODAL_OPEN_MS = 860;
    const BOOKING_MODAL_DISMISS_MS = 440;
    let openingTimer = null;
    let closingTimer = null;

    const openModal = (preset = {}) => {
      if (closingTimer) {
        window.clearTimeout(closingTimer);
        closingTimer = null;
      }

      savedSiteScrollTop = siteScrollRoot?.scrollTop || 0;
      lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      state.step = 1;
      state.selectedCategoryId = preset.categoryId || '';
      state.selectedBreedId = preset.breedId || '';
      state.selectedServiceId = preset.serviceId || '';
      state.selectedPrice = preset.price || '';
      state.selectedServiceLabel = preset.serviceLabel || '';
      state.selectedPriceOverride = preset.priceOverride || '';
      state.selectedService = bookingCatalog ? '' : preset.serviceName || state.selectedService;
      state.summaryConfirmed = false;
      clearValidationMessage();
      resetSummaryConfirmation();
      modal.classList.remove('booking-modal-sent', 'is-closing', 'is-alive', 'is-tilting');
      resetBookingTilt();
      syncHiddenFields();
      setStep(1);
      renderServiceList();
      lockSiteScroll();
      modal.classList.add('active', 'is-opening');
      modal.setAttribute('aria-hidden', 'false');

      if (openingTimer) {
        window.clearTimeout(openingTimer);
      }

      openingTimer = window.setTimeout(() => {
        modal.classList.remove('is-opening');
        modal.classList.add('is-alive');
        openingTimer = null;
      }, BOOKING_MODAL_OPEN_MS);

      window.requestAnimationFrame(() => {
        ensureBookingScrollbars();
        refreshDatetimeScrollState();
        refreshBookingScrollbars();
        sanitizeModalActionButtons();
        scanBookingNavPills(modal);
        modal.querySelector('[data-booking-breed], [data-booking-service], .service-option, input, button')?.focus();
        keepBookingModalViewportAtTop();
      });
    };

    const closeModal = () => {
      if (!modal.classList.contains('active') || modal.classList.contains('is-closing')) {
        return;
      }

      if (openingTimer) {
        window.clearTimeout(openingTimer);
        openingTimer = null;
      }

      clearValidationMessage();
      resetSummaryConfirmation();
      modal.classList.remove(
        'booking-modal-sent',
        'is-opening',
        'is-alive',
        'is-tilting',
        'is-step-forward',
        'is-step-back'
      );
      resetBookingTilt();
      modal.classList.add('is-closing');
      modal.setAttribute('aria-hidden', 'true');

      closingTimer = window.setTimeout(() => {
        modal.classList.remove('active', 'is-closing');
        closingTimer = null;
        unlockSiteScroll();
        lastFocusedElement?.focus();
      }, BOOKING_MODAL_DISMISS_MS);
    };

    const moveToDateStep = () => {
      if (!state.selectedService) {
        showValidationMessage(
          bookingCopy.chooseService,
          serviceList.querySelector('[data-booking-service], .service-option')
        );
        return;
      }

      const riskSelection = bookingCatalog
        ? [
            [state.clientType, bookingRiskCopy.clientTypeLabel, '[data-booking-client-type]'],
            [state.coatCondition, bookingRiskCopy.coatLabel, '[data-booking-coat-condition]'],
            [state.behavior, bookingRiskCopy.behaviourLabel, '[data-booking-behavior]'],
          ].find(([, , selector]) => !serviceList.querySelector(selector)?.value)
        : null;
      if (riskSelection) {
        showValidationMessage(bookingRiskCopy.chooseField(riskSelection[1]), serviceList.querySelector(riskSelection[2]));
        return;
      }

      setStep(2);
    };

    const moveToContactStep = () => {
      if (!state.selectedDate) {
        showValidationMessage(
          bookingCopy.chooseDate,
          calendarContainer.querySelector('.calendar-day.active, .calendar-day:not(.is-empty):not(.is-disabled)')
        );
        return;
      }

      if (!isFutureDate(state.selectedDate)) {
        showValidationMessage(bookingCopy.dateInPast, selectedDateField);
        return;
      }

      if (!state.selectedTime) {
        showValidationMessage(
          bookingCopy.chooseTime,
          timeSlotsContainer.querySelector('.time-slot.active, .time-slot')
        );
        return;
      }

      setStep(3);
    };

    openTriggers.forEach(trigger => {
      trigger.addEventListener('click', event => {
        if (trigger.getAttribute('aria-disabled') === 'true') {
          event.preventDefault();
          return;
        }
        event.preventDefault();
        openModal(resolveBookingPreset(trigger));
      });
    });

    nextStep1?.addEventListener('click', moveToDateStep);
    nextStep2?.addEventListener('click', moveToContactStep);
    prevStep2?.addEventListener('click', () => setStep(1));
    prevStep3?.addEventListener('click', () => setStep(2));
    closeTriggers.forEach(trigger => {
      trigger.addEventListener('click', closeModal);
    });
    closeControl?.addEventListener('click', closeModal);
    closeControl?.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        closeModal();
      }
    });

    modal.addEventListener('click', event => {
      if (event.target === modal) {
        closeModal();
      }
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && modal.classList.contains('active')) {
        closeModal();
      }
    });

    form.addEventListener('submit', async event => {
      event.preventDefault();
      clearValidationMessage();
      syncHiddenFields();

      if (!state.selectedService) {
        setStep(1);
        showValidationMessage(
          bookingCopy.chooseService,
          serviceList.querySelector('[data-booking-service], .service-option')
        );
        return;
      }

      if (!state.selectedDate) {
        setStep(2);
        showValidationMessage(
          bookingCopy.chooseDate,
          calendarContainer.querySelector('.calendar-day.active, .calendar-day:not(.is-empty):not(.is-disabled)')
        );
        return;
      }

      if (!isFutureDate(state.selectedDate)) {
        setStep(2);
        showValidationMessage(bookingCopy.dateInPast, selectedDateField);
        return;
      }

      if (!state.selectedTime) {
        setStep(2);
        showValidationMessage(
          bookingCopy.chooseTime,
          timeSlotsContainer.querySelector('.time-slot.active, .time-slot')
        );
        return;
      }

      const nameValue = form.querySelector('input[name="name"]')?.value?.trim() ?? '';
      const emailValue = form.querySelector('input[name="email"]')?.value?.trim() ?? '';
      const phoneValue = form.querySelector('input[name="phone"]')?.value?.trim() ?? '';

      if (!nameValue || !emailValue || !phoneValue) {
        setStep(3);
        showValidationMessage(
          bookingCopy.chooseContact,
          form.querySelector(
            !nameValue ? 'input[name="name"]' : !emailValue ? 'input[name="email"]' : 'input[name="phone"]'
          )
        );
        return;
      }

      if (!validateBookingFile()) {
        setStep(3);
        return;
      }

      if (privacyInput && !privacyInput.checked) {
        setStep(3);
        showValidationMessage(bookingCopy.choosePrivacy, privacyInput);
        return;
      }

      if (agbInput && !agbInput.checked) {
        setStep(3);
        showValidationMessage(bookingCopy.chooseAgb, agbInput);
        return;
      }

      if (!state.summaryConfirmed) {
        renderBookingSummary({ nameValue, emailValue, phoneValue });
        state.summaryConfirmed = true;
        const submitBtn = form.querySelector('[type="submit"]');
        if (submitBtn) {
          submitBtn.dataset.originalText = submitBtn.dataset.originalText || submitBtn.textContent;
          submitBtn.textContent = bookingCopy.summaryConfirm;
        }
        window.requestAnimationFrame(() => bookingSummary?.focus?.({ preventScroll: true }));
        return;
      }

      const uploadedOk = await ensureBookingFileUploaded();
      if (!uploadedOk) {
        setStep(3);
        return;
      }

      const paymentChoice = getPaymentChoice();
      const submitBtn = form.querySelector('[type="submit"]');

      if (paymentChoice === 'online') {
        showValidationMessage(bookingCopy.paymentUnavailable, submitBtn);
        return;
      }

      const sent = await submitSendmailForm(form, submitBtn);
      if (sent) {
        modal.classList.add('booking-modal-sent');
        try {
          window.hundesalonTrackConversion?.({ currency: 'EUR' });
        } catch {
          /* ignore */
        }
        state.selectedService = '';
        state.selectedDate = '';
        state.selectedTime = '';
        state.clientType = '';
        state.coatCondition = '';
        state.behavior = '';
        state.busyIntervals = [];
        state.availabilityConfigured = false;
        state.summaryConfirmed = false;
        state.uploadedFileUrl = '';
        syncHiddenFields();
        resetSummaryConfirmation();
        renderFilePreview();
      }
    });

    bindNativeBookingFields();
    updateDatetimeStepState();
    scanBookingNavPills(modal);
    scanBookingNavPills(document);

    // Stripe return path intentionally inactive while PAYMENTS_ONLINE_ENABLED is off.
    // Re-enable together with the online payment_choice UI when the salon opens.
  };

  const initPriceConfigurator = () => {
    if (document.body.classList.contains('price-page')) {
      document.querySelectorAll('.table-wrapper table').forEach(table => {
        const headers = Array.from(table.querySelectorAll('thead th')).map(cell => cell.textContent.trim());
        table.querySelectorAll('tbody tr').forEach(row => {
          Array.from(row.children).forEach((cell, index) => {
            if (cell instanceof HTMLElement) {
              cell.dataset.label = headers[index] || '';
            }
          });
        });
      });
    }

    const root = document.querySelector('[data-price-configurator]');
    if (!root) return;

    const serviceSelect = root.querySelector('[data-price-service-select]');
    const optionSelect = root.querySelector('[data-price-option-select]');
    const resultTitle = root.querySelector('[data-price-result-title]');
    const resultPrice = root.querySelector('[data-price-result-price]');
    const resultDescription = root.querySelector('[data-price-result-description]');
    const resultNote = root.querySelector('[data-price-result-note]');
    const buttonWrapper = root.querySelector('[data-price-booking-wrapper]');
    const bookingButton = root.querySelector('.select-service-btn');

    if (
      !serviceSelect ||
      !optionSelect ||
      !resultTitle ||
      !resultPrice ||
      !resultDescription ||
      !resultNote ||
      !buttonWrapper ||
      !bookingButton
    ) {
      return;
    }

    root.querySelector('[data-price-kicker]')?.replaceChildren(priceCopy.kicker);
    root.querySelector('[data-price-title]')?.replaceChildren(priceCopy.title);
    root.querySelector('[data-price-lead]')?.replaceChildren(priceCopy.lead);
    root.querySelector('[data-price-label-service]')?.replaceChildren(priceCopy.labels.service);
    root.querySelector('[data-price-label-option]')?.replaceChildren(priceCopy.labels.option);
    root.querySelector('[data-price-label-price]')?.replaceChildren(priceCopy.labels.price);
    root.querySelector('[data-price-label-description]')?.replaceChildren(priceCopy.labels.description);
    root.querySelector('[data-price-label-note]')?.replaceChildren(priceCopy.labels.note);
    bookingButton.textContent = priceCopy.labels.button;

    const servicesByKey = new Map(priceCopy.services.map(service => [service.key, service]));

    const renderEmptyState = () => {
      resultTitle.textContent = priceCopy.labels.emptyTitle;
      setCurrencyText(resultPrice, priceCopy.labels.emptyPrice);
      resultDescription.textContent = '';
      resultNote.textContent = '';
      buttonWrapper.dataset.service = '';
      bookingButton.disabled = true;
    };

    const renderSelection = () => {
      const service = servicesByKey.get(serviceSelect.value);
      const breed = priceCopy.findBreed?.(priceCopy.breedGroups, optionSelect.value);

      if (!service || !breed) {
        renderEmptyState();
        return;
      }

      if (!service.groups.includes(breed.group)) {
        resultTitle.textContent = priceCopy.labels.emptyTitle;
        setCurrencyText(resultPrice, priceCopy.labels.mismatch);
        resultDescription.textContent = '';
        setCurrencyText(resultNote, service.note);
        buttonWrapper.dataset.service = '';
        bookingButton.disabled = true;
        return;
      }

      const quote = priceCopy.resolveQuote?.(service, breed, pageLang) || {};
      resultTitle.textContent = `${service.label}: ${breed.label}`;
      setCurrencyText(resultPrice, quote.price || priceCopy.labels.emptyPrice);
      resultDescription.textContent = quote.description || service.description || '';
      setCurrencyText(resultNote, service.note);
      buttonWrapper.dataset.service = `${service.bookingService} — ${breed.label}`;
      bookingButton.disabled = !quote.price;
    };

    const populateBreeds = serviceKey => {
      const service = servicesByKey.get(serviceKey);
      optionSelect.innerHTML = '';

      if (!service || !priceCopy.breedGroups) {
        renderEmptyState();
        optionSelect.disabled = true;
        return;
      }

      const groupOrder = window.PriceCatalog?.GROUP_ORDER || ['dogs', 'cats', 'others'];
      let hasOptions = false;

      groupOrder.forEach(groupKey => {
        if (!service.groups.includes(groupKey)) return;
        const group = priceCopy.breedGroups[groupKey];
        if (!group?.items?.length) return;

        const optgroup = document.createElement('optgroup');
        optgroup.label = group.label;

        group.items.forEach(item => {
          const optionEl = document.createElement('option');
          optionEl.value = priceCopy.breedValue(item);
          optionEl.textContent = item.label;
          if (item.isOther) {
            optionEl.dataset.other = 'true';
            optionEl.className = 'site-select-option-other';
          }
          optgroup.append(optionEl);
          hasOptions = true;
        });

        optionSelect.append(optgroup);
      });

      optionSelect.disabled = !hasOptions;
      if (hasOptions) {
        optionSelect.selectedIndex = 0;
      }
      window.refreshSiteSelect?.(optionSelect);
      renderSelection();
    };

    serviceSelect.innerHTML = '';
    priceCopy.services.forEach(service => {
      const optionEl = document.createElement('option');
      optionEl.value = service.key;
      optionEl.textContent = service.label;
      serviceSelect.append(optionEl);
    });
    serviceSelect.value = servicesByKey.has('full-groom') ? 'full-groom' : priceCopy.services[0]?.key || '';
    window.refreshSiteSelect?.(serviceSelect);

    serviceSelect.addEventListener('change', () => populateBreeds(serviceSelect.value));
    optionSelect.addEventListener('change', renderSelection);

    populateBreeds(serviceSelect.value);
    root.setAttribute('data-price-ready', 'true');
  };

  initSendmailForms();
  initMessageDraftTools();
  initSmoothHashLinks();
  initPriceConfigurator();
  initBookingModal();
});
