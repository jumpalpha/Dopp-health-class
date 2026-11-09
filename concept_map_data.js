/*
 * concept_map_data.js — the "big ideas" for the Concept Map game in vocab_engine.html.
 *
 * Each chapter's vocabulary is grouped into 3–5 big ideas. A big idea has:
 *   name   short label shown on the map
 *   idea   ONE sentence that says what the terms in it have in common. Students use it to decide
 *          where a term belongs, and it is quoted back in the feedback, so the reason is always visible.
 *   terms  exact term names from ALL_CHAPTERS in vocab_engine.html (every term listed once)
 * skip     terms left out of the map (the chapter's umbrella word, or a term with no clear group)
 *
 * Written 2026-11-09 to replace the old category labels ("Other", "Core Concepts", one-term groups,
 * and Chapter 3 where every term had the same label). Teacher: edit freely; keep term names exact.
 */
window.CONCEPT_MAP = {
  1: { groups: [
    { name: "What health means", idea: "Words that describe what health is and how people learn about it and promote it.",
      terms: ["Health", "Wellness", "Health Triangle", "Spiritual health", "Health literacy", "Health education", "Healthy People 2030", "Health promotion"] },
    { name: "Risk and protection", idea: "Things that raise or lower your chances of health problems over time.",
      terms: ["Risk behaviors", "Prevention", "Abstinence", "Protective factors", "Chronic disease", "Cumulative risks", "Health disparities"] },
    { name: "What shapes your health", idea: "Outside and inside influences — from genes to friends to screens — that affect your health choices.",
      terms: ["Lifestyle factors", "Heredity", "Environment", "Culture", "Peers", "Attitude", "Media", "Technology"] }
  ] },
  2: { groups: [
    { name: "Setting goals", idea: "Tools for deciding what you want to achieve and planning the steps to get there.",
      terms: ["Goal setting", "SMART goals", "Goals", "Short-term goal", "Long-term goal", "Action plan", "Self-management"] },
    { name: "Making decisions", idea: "Skills for thinking a choice through: knowing your values, checking facts and spotting influences.",
      terms: ["Decision making", "Decision-making skills", "Values", "Analyzing influences", "Accessing information", "Health skills"] },
    { name: "People skills", idea: "Skills you use with other people — talking, saying no, solving conflicts — and handling the stress that comes with it.",
      terms: ["Refusal skills", "Conflict resolution", "Communication skills", "Interpersonal communication", "Stress management", "Stress", "Advocacy"] },
    { name: "Smart health consumer", idea: "Words about buying health products and services wisely and protecting yourself from scams.",
      terms: ["Health consumer", "Advertising", "Comparison shopping", "Warranty", "Consumer advocates", "Malpractice", "Health fraud"] }
  ] },
  3: { groups: [
    { name: "Who you are", idea: "Words for how you see yourself and the qualities that make you, you.",
      terms: ["Self-concept", "Self-esteem", "Personal identity", "Personality", "Character", "Integrity", "Role model", "Positive affirmations"] },
    { name: "Feelings and emotions", idea: "Words about emotions — what they are, where they come from, and understanding them in yourself and others.",
      terms: ["Mental health", "Mental/emotional health", "Emotions", "Empathy", "Emotional intelligence", "Hormones", "Hostility", "Grief"] },
    { name: "Coping and growing", idea: "Ways people handle hard times and keep growing toward their potential.",
      terms: ["Resiliency", "Coping strategies", "Defense mechanisms", "Mindfulness", "Constructive criticism", "Competence", "Hierarchy of needs", "Self-actualization"] }
  ] },
  4: { groups: [
    { name: "What stress is", idea: "Words that name kinds of stress and what causes it.",
      terms: ["Stress", "Stressor", "Eustress", "Distress", "Acute stress", "Chronic stress", "Burnout"] },
    { name: "The body's stress response", idea: "What happens inside your body when stress hits — hormones, stages, and calming back down.",
      terms: ["Fight-or-flight response", "Adrenaline", "Cortisol", "General Adaptation Syndrome", "Alarm stage", "Exhaustion stage", "Relaxation response"] },
    { name: "Coping with stress", idea: "Skills and supports that help you manage stress and bounce back.",
      terms: ["Time management", "Support network", "Resilience", "Mindfulness", "Reframing", "Post-traumatic growth", "Progressive muscle relaxation"] }
  ] },
  5: { groups: [
    { name: "Mental disorders", idea: "Names of mental health conditions that affect how people think, feel or act.",
      terms: ["Mental disorder", "Anxiety disorder", "Depression", "Phobia", "ADHD", "Obsessive-compulsive disorder (OCD)", "Panic disorder", "Social anxiety", "PTSD"] },
    { name: "Eating disorders", idea: "Serious illnesses involving extreme eating behaviors and body image.",
      terms: ["Eating disorder", "Anorexia nervosa", "Bulimia nervosa"] },
    { name: "Getting help", idea: "The people and treatments that help — and the stigma that can stop someone from asking.",
      terms: ["Therapy", "Psychiatry", "Psychiatrist", "Therapist", "Stigma"] },
    { name: "Crisis and suicide prevention", idea: "Words about suicide, its warning signs, and where to get help right away.",
      terms: ["Suicide", "Suicide prevention", "Crisis line"] }
  ] },
  6: { groups: [
    { name: "Healthy relationship qualities", idea: "What a healthy relationship is built on.",
      terms: ["Relationship", "Healthy relationship", "Trust", "Respect", "Reciprocity", "Boundary", "Boundaries"] },
    { name: "Warning signs", idea: "Behaviors that hurt a relationship or push people around.",
      terms: ["Jealousy", "Manipulation", "Peer pressure", "Aggressive communication", "Passive communication"] },
    { name: "Communication skills", idea: "Ways to send and receive messages clearly and respectfully.",
      terms: ["Communication", "Active listening", "Assertiveness", "I statements", "Nonverbal communication"] },
    { name: "Saying no", idea: "Techniques for refusing pressure while staying calm.",
      terms: ["Refusal skills", "Broken record technique", "Delay tactic"] }
  ] },
  7: { groups: [
    { name: "Kinds of families", idea: "The different ways families can be formed and structured.",
      terms: ["Nuclear family", "Blended family", "Extended family", "Single-parent family", "Foster care", "Adoption", "Siblings"] },
    { name: "Strong families and change", idea: "What keeps families close, and big changes families go through.",
      terms: ["Affirmation", "Commitment", "Separation", "Divorce", "Custody"] },
    { name: "Abuse and getting help", idea: "Kinds of family abuse, how it repeats, and where to find help.",
      terms: ["Abuse", "Domestic violence", "Spousal abuse", "Child abuse", "Neglect", "Elder abuse", "Cycle of violence", "Crisis center"] }
  ] },
  8: { groups: [
    { name: "Friendships", idea: "Types of friendships and peer groups, and staying safe with people you meet online.",
      terms: ["Peers", "Platonic friendship", "Clique", "Casual friendship", "Close friendship", "Online safety"] },
    { name: "Pressure from peers", idea: "Ways peers influence or push you — for good or bad.",
      terms: ["Peer pressure", "Harassment", "Manipulation", "Positive peer pressure"] },
    { name: "Resisting pressure", idea: "Steps you can take to say no and stick to it.",
      terms: ["Refusal skills", "State your position", "Suggest alternatives", "Stand your ground"] },
    { name: "Dating and limits", idea: "Words about dating, closeness and setting healthy limits.",
      terms: ["Priorities", "Intimacy", "Infatuation", "Abstinence", "Self-control", "Sexually transmitted infections (STIs)"] }
  ] },
  9: { groups: [
    { name: "Conflict and resolving it", idea: "What conflict is, how it grows, and calm ways to settle it.",
      terms: ["Conflict", "Interpersonal conflicts", "Escalate", "Negotiation", "Mediation", "Peer mediation", "Confidentiality"] },
    { name: "Violence", idea: "Kinds of violent acts and crimes against people.",
      terms: ["Violence", "Assault", "Random violence", "Homicide", "Sexual violence", "Hate crime"] },
    { name: "Bullying", idea: "Bullying in person or online, and the person who steps in to help.",
      terms: ["Bullying", "Cyberbullying", "Upstander"] },
    { name: "Abuse", idea: "Ongoing harm from someone, whether physical, emotional or by following you.",
      terms: ["Physical abuse", "Emotional abuse", "Verbal abuse", "Stalking"] }
  ] },
  10: { groups: [
    { name: "Nutrient basics", idea: "Basic nutrition words, plus the vitamins and minerals your body needs in small amounts.",
      terms: ["Nutrients", "Calorie", "Vitamins", "Minerals", "Sodium"] },
    { name: "Carbs, proteins and fiber", idea: "The big nutrients that give your body energy and building material.",
      terms: ["Carbohydrates", "Proteins", "Fats", "Fiber", "Dietary fiber"] },
    { name: "Kinds of fat", idea: "Types of fat — which ones help your heart and which ones harm it.",
      terms: ["Saturated fat", "Trans fat", "Unsaturated fat"] },
    { name: "Reading food and guidelines", idea: "Tools and rules for choosing foods: labels, servings and national guidelines.",
      terms: ["MyPlate", "Nutrition label", "Dietary guidelines", "Added sugars", "Serving size", "Percent Daily Value", "Ultra-processed foods"] }
  ] },
  11: { groups: [
    { name: "Measuring body weight", idea: "Ways body size and weight are measured and labeled.",
      terms: ["Body Mass Index (BMI)", "Obesity", "Body composition", "Underweight", "Overweight"] },
    { name: "Energy balance", idea: "How your body uses calories, and healthy versus unhealthy ways to manage weight.",
      terms: ["Metabolism", "Basal metabolic rate", "Caloric balance", "Weight management", "Fad diet", "All Foods Fit"] },
    { name: "Your relationship with food", idea: "How feelings and body image affect the way you eat.",
      terms: ["Body image", "Intuitive eating", "Mindful eating", "Emotional eating"] },
    { name: "Eating disorders", idea: "Serious illnesses involving extreme eating behaviors.",
      terms: ["Eating disorder", "Anorexia nervosa", "Bulimia nervosa", "Binge eating disorder", "Orthorexia"] }
  ] },
  12: { groups: [
    { name: "Activity basics", idea: "Basic words for moving your body and the two main kinds of exercise.",
      terms: ["Physical activity", "Exercise", "Physical fitness", "Aerobic exercise", "Anaerobic exercise"] },
    { name: "Health-related fitness", idea: "Parts of fitness that keep your heart, muscles and joints healthy.",
      terms: ["Flexibility", "Muscle strength", "Muscle endurance", "Cardiovascular endurance"] },
    { name: "Skill-related fitness", idea: "Parts of fitness that help you perform in sports and games.",
      terms: ["Skill-related fitness", "Agility", "Balance", "Coordination", "Reaction time"] },
    { name: "Training safely", idea: "Rules for planning workouts and avoiding or treating injuries.",
      terms: ["FITT principle", "Overload principle", "Warm-up", "Cool-down", "RICE", "Overtraining"] }
  ] },
  13: { groups: [
    { name: "Skin", idea: "Parts of the skin, skin problems, and protecting your skin.",
      terms: ["Epidermis", "Dermis", "Melanin", "Sebaceous glands", "Melanoma", "SPF", "Acne", "Dermatologist"] },
    { name: "Teeth and gums", idea: "Parts of the mouth, problems that start there, and what protects teeth.",
      terms: ["Periodontium", "Plaque", "Halitosis", "Periodontal disease", "Fluoride"] },
    { name: "Eyes and ears", idea: "Parts of the eye and a hearing problem.",
      terms: ["Sclera", "Retina", "Tinnitus"] },
    { name: "Everyday care and health care", idea: "Daily habits and medical care that keep you healthy.",
      terms: ["Hygiene", "Preventive care", "Immunization", "Consumer health", "OTC medication"] }
  ] },
  14: { groups: [
    { name: "Skeletal system", idea: "Bones, joints, the tissues that hold them together, and bone problems.",
      terms: ["Cartilage", "Ossification", "Ligament", "Tendon", "Scoliosis", "Osteoporosis", "Skeletal system", "Axial skeleton", "Appendicular skeleton"] },
    { name: "Muscular system", idea: "Kinds of muscle and a muscle-related injury.",
      terms: ["Skeletal muscles", "Cardiac muscle", "Tendinitis"] },
    { name: "Nervous system", idea: "The brain, nerves, and how messages travel through your body.",
      terms: ["Neurons", "Cerebrum", "Cerebellum", "Brain stem", "Epilepsy", "Synapse", "Reflex", "Central nervous system", "Peripheral nervous system"] }
  ] },
  15: { groups: [
    { name: "Heart and blood vessels", idea: "The heart, the tubes that carry blood, and problems with blood flow.",
      terms: ["Cardiovascular system", "Artery", "Vein", "Capillaries", "Blood pressure", "Cholesterol", "Hypertension"] },
    { name: "Blood", idea: "The parts that make up blood itself.",
      terms: ["Plasma", "Hemoglobin", "Platelets"] },
    { name: "Breathing", idea: "Parts of the respiratory system and diseases that make breathing hard.",
      terms: ["Diaphragm", "Trachea", "Asthma", "Emphysema", "Alveoli", "Cilia"] },
    { name: "Digestion and waste", idea: "How food is broken down and absorbed, and how waste is filtered out.",
      terms: ["Mastication", "Peristalsis", "Villi", "Nephrons"] }
  ] },
  16: { groups: [
    { name: "Endocrine system", idea: "Glands and the hormones they release to control growth, energy and blood sugar.",
      terms: ["Endocrine glands", "Hormones", "Thyroid gland", "Pancreas", "Pituitary gland", "Endocrine system", "Insulin", "Adrenal glands", "Glucagon"] },
    { name: "Reproductive organs and sex hormones", idea: "The organs that make eggs or sperm, and the hormones they produce.",
      terms: ["Testes", "Ovaries", "Uterus", "Testosterone", "Estrogen", "Progesterone"] },
    { name: "Puberty and the menstrual cycle", idea: "The changes and monthly cycle that make reproduction possible.",
      terms: ["Puberty", "Ovulation", "Menstruation", "Menstrual cycle", "Fertilization"] }
  ] },
  17: { groups: [
    { name: "From conception to fetus", idea: "Stages a baby goes through as it forms and grows before birth.",
      terms: ["Fertilization", "Zygote", "Implantation", "Embryo", "Fetus", "Placenta"] },
    { name: "Healthy pregnancy and birth", idea: "What helps or harms a baby during pregnancy, and how birth happens.",
      terms: ["Prenatal care", "Folic acid", "Teratogen", "Fetal Alcohol Spectrum Disorders", "Trimester", "Labor", "Cesarean section"] },
    { name: "Genetics", idea: "How traits are passed down from parents.",
      terms: ["Chromosomes", "Genes", "DNA", "Gene therapy"] },
    { name: "Infancy and childhood", idea: "Growing up after birth, and a danger to babies.",
      terms: ["Developmental tasks", "Autonomy", "SIDS"] }
  ] },
  18: { groups: [
    { name: "Adolescence and the teen brain", idea: "How teens develop in body, mind and brain.",
      terms: ["Adolescence", "Cognition", "Prefrontal cortex", "Limbic system", "Physical maturity", "Emotional maturity"] },
    { name: "Adulthood", idea: "Commitments and life changes during early and middle adulthood.",
      terms: ["Commitment", "Transitions", "Empty-nest syndrome", "Midlife crisis", "Middle adulthood"] },
    { name: "Aging", idea: "How the body and life change as people grow older, and how to age well.",
      terms: ["Menopause", "Sarcopenia", "Life expectancy", "Gerontology", "Active aging", "Integrity"] },
    { name: "End of life and grief", idea: "Caring for the dying and dealing with loss.",
      terms: ["Grief", "Kübler-Ross stages", "Hospice"] }
  ] },
  19: { groups: [
    { name: "Medicines", idea: "Kinds of medicines, how you get them, and their unwanted effects.",
      terms: ["Medicines", "Drugs", "Vaccine", "Side effects", "Prescription medicines", "Over-the-counter medicines"] },
    { name: "Misuse and abuse", idea: "Unsafe ways of using medicines and drugs.",
      terms: ["Medicine misuse", "Medicine abuse", "Drug misuse", "Drug abuse", "Synergistic effect"] },
    { name: "Overdose", idea: "Overdose, the drugs most likely to cause it, and the medicine that reverses it.",
      terms: ["Drug overdose", "Naloxone", "Fentanyl", "Opioid"] },
    { name: "How drugs affect the body", idea: "How drugs change the body over time and what they do to the nervous system.",
      terms: ["Tolerance", "Dependence", "Addiction", "Stimulant", "Depressant"] }
  ] },
  20: { groups: [
    { name: "What's in tobacco", idea: "Harmful chemicals found in tobacco and its smoke.",
      terms: ["Nicotine", "Carcinogen", "Tar", "Carbon monoxide", "Formaldehyde"] },
    { name: "Tobacco products", idea: "Ways people use tobacco and nicotine.",
      terms: ["E-cigarettes", "Vaping", "Smokeless tobacco"] },
    { name: "Health damage", idea: "Diseases and injuries caused by tobacco or vaping.",
      terms: ["Leukoplakia", "COPD", "Emphysema", "EVALI"] },
    { name: "Quitting", idea: "What quitting feels like and what helps people quit.",
      terms: ["Nicotine withdrawal", "Nicotine substitutes", "Cessation", "Nicotine replacement therapy"] },
    { name: "Secondhand smoke", idea: "Smoke that reaches people who aren't smoking.",
      terms: ["Environmental tobacco smoke", "Mainstream smoke", "Sidestream smoke", "Secondhand smoke"] }
  ] },
  21: { groups: [
    { name: "Alcohol in the body", idea: "What alcohol is and how its effects are measured.",
      terms: ["Ethanol", "Depressant", "Intoxication", "Blood alcohol concentration", "Standard drink"] },
    { name: "Dangerous drinking", idea: "Risky drinking situations and how to help someone in danger.",
      terms: ["Binge drinking", "Alcohol poisoning", "Underage drinking", "Peer pressure", "Recovery position"] },
    { name: "Dependence", idea: "How the body and mind come to need alcohol, and getting support.",
      terms: ["Psychological dependence", "Physiological dependence", "Alcohol use disorder", "Tolerance", "Withdrawal", "Support group"] },
    { name: "Long-term effects", idea: "Lasting damage alcohol causes to organs or an unborn baby.",
      terms: ["Fetal Alcohol Spectrum Disorders", "Cirrhosis", "Cardiomyopathy", "Fatty liver"] }
  ] },
  22: { groups: [
    { name: "Types of drugs", idea: "Specific illegal drugs and the groups they belong to.",
      terms: ["Illegal drugs", "Marijuana", "THC", "Inhalants", "Anabolic steroids", "Hallucinogens", "Stimulants", "Methamphetamine", "MDMA"] },
    { name: "Opioids and overdose", idea: "Opioids, why fake pills are deadly, and the medicine that reverses an overdose.",
      terms: ["Opiates", "Opioid", "Fentanyl", "Counterfeit pills", "Naloxone"] },
    { name: "Addiction and recovery", idea: "How drug use changes the brain and how people recover.",
      terms: ["Substance abuse", "Addiction", "Dopamine", "Anhedonia", "Gateway drug", "Rehabilitation"] }
  ] },
  23: { groups: [
    { name: "Germs and infection", idea: "The germs that cause disease and what fights bacteria.",
      terms: ["Communicable disease", "Infection", "Pathogen", "Virus", "Bacteria", "Antibiotic"] },
    { name: "How diseases spread", idea: "How germs travel and how far an outbreak reaches.",
      terms: ["Vector", "Incubation period", "Fomite", "Pandemic", "Epidemic", "Emerging infections"] },
    { name: "Your immune system", idea: "How your body defends itself and remembers germs.",
      terms: ["Immune system", "Antibody", "Immunity", "Inflammatory response", "Memory cells"] },
    { name: "Vaccines", idea: "Vaccines and how they protect you and your community.",
      terms: ["Vaccine", "mRNA vaccine", "Herd immunity"] }
  ] },
  24: { groups: [
    { name: "Common STIs", idea: "Names of specific sexually transmitted infections.",
      terms: ["HPV", "Chlamydia", "Gonorrhea", "Syphilis", "Herpes", "Hepatitis B", "Trichomoniasis"] },
    { name: "Prevention and testing", idea: "How STIs hide, how to prevent them, and why testing and telling partners matter.",
      terms: ["Sexually transmitted infection", "Asymptomatic", "Abstinence", "Gardasil 9", "STI testing", "Partner notification", "Stigma"] },
    { name: "HIV", idea: "HIV, AIDS, and the treatment and prevention tools for them.",
      terms: ["HIV", "AIDS", "Antiretroviral therapy", "U=U", "PrEP", "CD4 T-cells"] }
  ] },
  25: { skip: ["Noncommunicable disease", "Allergy"], groups: [
    { name: "Heart and blood vessel disease", idea: "Diseases of the heart and blood vessels.",
      terms: ["Cardiovascular disease", "Hypertension", "Atherosclerosis", "Stroke"] },
    { name: "Cancer", idea: "What cancer is, how it spreads, and words for tumors and recovery.",
      terms: ["Cancer", "Tumor", "Metastasis", "Remission", "Malignant", "Benign"] },
    { name: "Diabetes", idea: "Blood sugar, the hormone that controls it, and the types of diabetes.",
      terms: ["Diabetes", "Insulin", "Type 1 diabetes", "Type 2 diabetes", "Prediabetes"] },
    { name: "Disabilities", idea: "Living with a disability, and the laws, words and tools that support people.",
      terms: ["Disability", "Americans with Disabilities Act", "People-first language", "Assistive technology"] }
  ] },
  26: { groups: [
    { name: "Thinking about safety", idea: "How accidents happen and the general ways to prevent them.",
      terms: ["Personal safety", "Accident", "Accident chain", "Passive safety", "Active safety", "OSHA", "Cyberbullying"] },
    { name: "Road safety", idea: "Staying safe in and around cars.",
      terms: ["Defensive driving", "Road rage", "Graduated licensing", "Distracted driving", "Seat belt"] },
    { name: "Home and disaster safety", idea: "Being ready for fires and disasters at home.",
      terms: ["Fire safety", "Fire escape plan", "Emergency kit"] },
    { name: "Sports and outdoor safety", idea: "Dangers during sports, heat and water.",
      terms: ["Personal flotation device", "Concussion", "Second impact syndrome", "Heat exhaustion", "Heat stroke"] }
  ] },
  27: { groups: [
    { name: "First aid basics", idea: "The first steps, rules and supplies for any emergency.",
      terms: ["First aid", "Check-Call-Care", "Universal precautions", "Good Samaritan laws", "Emergency survival kit", "Triage"] },
    { name: "Cardiac emergencies", idea: "What to do when someone's heart stops.",
      terms: ["CPR", "Hands-Only CPR", "AED", "Chain of survival"] },
    { name: "Life-threatening emergencies", idea: "Choking, heavy bleeding, shock and severe allergic reactions — and how to respond.",
      terms: ["Heimlich maneuver", "Tourniquet", "Shock", "Anaphylaxis", "Epinephrine auto-injector", "Recovery position"] },
    { name: "Injuries", idea: "Common injuries and how to care for them.",
      terms: ["Fracture", "Concussion", "P.R.I.C.E.", "Hypothermia"] }
  ] },
  28: { groups: [
    { name: "Health care", idea: "How people get medical care and pay for it.",
      terms: ["Health care system", "Primary care physician", "Health insurance", "Specialists", "Medical history"] },
    { name: "Community health", idea: "How whole communities stay healthy and why health isn't equal for everyone.",
      terms: ["Public health", "Community health", "Social determinants of health", "Health disparity", "Health advocacy", "Health equity"] },
    { name: "Pollution", idea: "Harmful things in the air, water and ground.",
      terms: ["Air pollution", "Smog", "Radon", "Water pollution", "Hazardous waste", "Air quality index"] },
    { name: "Protecting the planet", idea: "Ways people protect the environment and our health from it.",
      terms: ["EPA", "Environmental health", "Greenhouse gases", "Sustainability"] }
  ] }
};
